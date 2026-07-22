import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEVICE_SESSION_MIGRATION_KEY,
  type DeviceSessionMigrationDatabase,
  type DeviceSessionMigrationTransaction,
  migrateDeviceSessions,
} from "./device-session-migration";
import { resolveSqliteDatabasePath } from "./sqlite-database-path";

class MemoryMigrationDatabase implements DeviceSessionMigrationDatabase {
  sessions: number;
  marker = false;
  createFailure: Error | null = null;
  createFailures: Error[] = [];
  publishMarkerAfterRollback = false;
  transactionCalls = 0;
  findMigrationCalls = 0;
  findMigrationFailures: Array<Error | null> = [];
  transactionMarkerFailures: Error[] = [];

  constructor(sessions: number) {
    this.sessions = sessions;
  }

  async findMigration(key: string): Promise<boolean> {
    this.findMigrationCalls += 1;
    assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
    const failure = this.findMigrationFailures.shift();
    if (failure) throw failure;
    return this.marker;
  }

  async transaction<T>(work: (tx: DeviceSessionMigrationTransaction) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    const snapshot = { sessions: this.sessions, marker: this.marker };
    const tx: DeviceSessionMigrationTransaction = {
      findMigration: async (key) => {
        assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
        const failure = this.transactionMarkerFailures.shift();
        if (failure) throw failure;
        return this.marker;
      },
      clearSessions: async () => {
        const count = this.sessions;
        this.sessions = 0;
        return count;
      },
      createMigration: async (key) => {
        assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
        const queuedFailure = this.createFailures.shift();
        if (queuedFailure) throw queuedFailure;
        if (this.createFailure) throw this.createFailure;
        if (this.marker) throw Object.assign(new Error("unique migration key"), { code: "P2002" });
        this.marker = true;
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.sessions = snapshot.sessions;
      this.marker = snapshot.marker;
      if (this.publishMarkerAfterRollback) this.marker = true;
      throw error;
    }
  }
}

test("legacy sessions are cleared once and subsequent runs preserve new sessions", async () => {
  const database = new MemoryMigrationDatabase(4);

  assert.deepEqual(await migrateDeviceSessions(database), {
    clearedSessions: 4,
    alreadyApplied: false,
  });
  database.sessions = 2;
  assert.deepEqual(await migrateDeviceSessions(database), {
    clearedSessions: 0,
    alreadyApplied: true,
  });
  assert.equal(database.sessions, 2);
});

test("a failed marker insert rolls back the session deletion", async () => {
  const database = new MemoryMigrationDatabase(3);
  database.createFailure = new Error("marker write failed");

  await assert.rejects(migrateDeviceSessions(database), /marker write failed/);
  assert.equal(database.sessions, 3);
  assert.equal(database.marker, false);
});

test("a concurrent unique-key winner becomes a safe no-op after loser rollback", async () => {
  const database = new MemoryMigrationDatabase(5);
  database.createFailure = Object.assign(new Error("unique migration key"), { code: "P2002" });
  database.publishMarkerAfterRollback = true;

  assert.deepEqual(await migrateDeviceSessions(database), {
    clearedSessions: 0,
    alreadyApplied: true,
  });
  assert.equal(database.sessions, 5, "the losing transaction must not retain its session deletion");
});

test("SQLite busy retries only after rechecking the marker and remains bounded", async () => {
  const database = new MemoryMigrationDatabase(2);
  database.createFailures.push(Object.assign(new Error("database is locked"), { code: "P2034" }));

  assert.deepEqual(
    await migrateDeviceSessions(database, { maxAttempts: 2, retryDelayMs: 0 }),
    { clearedSessions: 2, alreadyApplied: false },
  );
  assert.equal(database.transactionCalls, 2);
  assert.ok(database.findMigrationCalls >= 2, "the marker must be rechecked before retrying deletion");

  const persistentlyBusy = new MemoryMigrationDatabase(1);
  persistentlyBusy.createFailure = Object.assign(new Error("database is locked"), { code: "P1008" });
  await assert.rejects(
    migrateDeviceSessions(persistentlyBusy, { maxAttempts: 2, retryDelayMs: 0 }),
    /database is locked/,
  );
  assert.equal(persistentlyBusy.sessions, 1);
  assert.equal(persistentlyBusy.transactionCalls, 2);
});

test("SQLite busy is bounded across initial, transactional, and post-rollback marker reads", async () => {
  for (const error of [
    Object.assign(new Error("initial timeout"), { code: "P1008" }),
    Object.assign(new Error("transaction conflict"), { code: "P2034" }),
    new Error("SQLITE_BUSY while reading marker"),
  ]) {
    const initialBusy = new MemoryMigrationDatabase(1);
    initialBusy.findMigrationFailures.push(error);
    assert.deepEqual(
      await migrateDeviceSessions(initialBusy, { maxAttempts: 3, retryDelayMs: 0 }),
      { clearedSessions: 1, alreadyApplied: false },
    );
    assert.equal(initialBusy.transactionCalls, 1);
  }

  const transactionReadBusy = new MemoryMigrationDatabase(2);
  transactionReadBusy.transactionMarkerFailures.push(new Error("SQLITE_BUSY"));
  assert.deepEqual(
    await migrateDeviceSessions(transactionReadBusy, { maxAttempts: 3, retryDelayMs: 0 }),
    { clearedSessions: 2, alreadyApplied: false },
  );
  assert.equal(transactionReadBusy.transactionCalls, 2);

  const postRollbackReadBusy = new MemoryMigrationDatabase(3);
  postRollbackReadBusy.createFailures.push(Object.assign(new Error("locked"), { code: "P2034" }));
  postRollbackReadBusy.findMigrationFailures.push(null, new Error("SQLITE_BUSY"));
  assert.deepEqual(
    await migrateDeviceSessions(postRollbackReadBusy, { maxAttempts: 3, retryDelayMs: 0 }),
    { clearedSessions: 3, alreadyApplied: false },
  );
  assert.equal(postRollbackReadBusy.transactionCalls, 2);

  const persistentlyBusyMarker = new MemoryMigrationDatabase(4);
  persistentlyBusyMarker.findMigrationFailures.push(
    Object.assign(new Error("read timeout 1"), { code: "P1008" }),
    new Error("SQLITE_BUSY post-check 1"),
    Object.assign(new Error("read timeout 2"), { code: "P2034" }),
    new Error("SQLITE_BUSY post-check 2"),
  );
  await assert.rejects(
    migrateDeviceSessions(persistentlyBusyMarker, { maxAttempts: 2, retryDelayMs: 0 }),
    /SQLITE_BUSY post-check 2/,
  );
  assert.equal(persistentlyBusyMarker.transactionCalls, 0);
  assert.equal(persistentlyBusyMarker.sessions, 4);
});

test("deployment resolves the actual SQLite DATABASE_URL without exposing other env values", () => {
  assert.equal(
    resolveSqliteDatabasePath("file:/opt/student-management/shared/custom.db", "/release/prisma"),
    "/opt/student-management/shared/custom.db",
  );
  assert.equal(
    resolveSqliteDatabasePath("file:./dev.db", "/release/prisma"),
    "/release/prisma/dev.db",
  );
  assert.throws(
    () => resolveSqliteDatabasePath("postgresql://secret@example/db", "/release/prisma"),
    /sqlite_database_url_required/,
  );
});

test("migration CLI and deployment run the one-time migration in the safe order", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const cli = readFileSync("scripts/migrate-device-sessions.ts", "utf8");
  const deploy = readFileSync("deploy/deploy-update.sh", "utf8");
  const serverInit = readFileSync("deploy/server-init.sh", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const backup = readFileSync("deploy/backup-db.sh", "utf8");
  const restore = readFileSync("deploy/restore-release.sh", "utf8");
  const rollback = readFileSync("deploy/rollback.sh", "utf8");
  const healthRoute = readFileSync("src/app/api/health/route.ts", "utf8");

  assert.equal(
    packageJson.scripts["devices:migrate"],
    "node --import tsx scripts/migrate-device-sessions.ts",
  );
  assert.match(cli, /loadEnvFile\s*\(\s*["']\.env["']\s*\)/);
  assert.ok(cli.indexOf('loadEnvFile(".env")') < cli.indexOf('import("../src/lib/prisma")'));
  assert.match(cli, /migrateDeviceSessions\s*\(/);
  assert.match(cli, /process\.exitCode\s*=\s*1/);
  assert.match(cli, /finally/);
  assert.match(cli, /prisma\.\$disconnect\s*\(/);

  const envLinkIndex = deploy.indexOf('ln -sfn "$SHARED_DIR/.env" ".env"');
  const schemaIndex = deploy.indexOf("npx prisma db push --skip-generate");
  const stopIndex = deploy.indexOf('pm2 stop "$APP_NAME"');
  const backupIndex = deploy.indexOf(".backup");
  const migrationIndex = deploy.indexOf("npm run devices:migrate");
  const buildIndex = deploy.indexOf("npm run build");
  const switchIndex = deploy.indexOf('ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"');
  const startIndex = deploy.lastIndexOf("pm2 start");
  assert.ok(envLinkIndex >= 0 && buildIndex > envLinkIndex);
  assert.ok(stopIndex > buildIndex && backupIndex > stopIndex);
  assert.ok(schemaIndex > backupIndex && migrationIndex > schemaIndex);
  assert.ok(switchIndex > migrationIndex && startIndex > switchIndex);
  assert.match(deploy, /flock\s+-n/);
  assert.match(deploy, /PREVIOUS_RELEASE/);
  assert.match(deploy, /scripts\/resolve-sqlite-database-path\.ts/);
  const unsetDatabaseIndex = deploy.indexOf("unset DATABASE_URL");
  const resolveDatabaseIndex = deploy.indexOf("scripts/resolve-sqlite-database-path.ts");
  assert.ok(unsetDatabaseIndex >= 0 && unsetDatabaseIndex < resolveDatabaseIndex);
  assert.match(deploy, /DATABASE_URL="file:\$DB_PATH"/);
  assert.match(deploy, /export DATABASE_URL/);
  assert.match(deploy, /id -u/);
  assert.match(deploy, /HEALTHCHECK_URL/);
  assert.match(deploy, /curl\s+[^\n]*HEALTHCHECK_URL/);
  assert.match(deploy, /restore_previous_release/);
  assert.doesNotMatch(deploy, /restore_previous_release\s*\|\|\s*true/);
  assert.doesNotMatch(deploy, /cp\s+[^\n]*dev\.db/);
  assert.doesNotMatch(serverInit, /devices:migrate/);
  assert.match(backup, /sqlite3\s+"\$DB_PATH"\s+"\.backup/);
  assert.match(backup, /resolve-sqlite-database-path\.ts/);
  assert.ok(backup.indexOf("unset DATABASE_URL") < backup.indexOf("resolve-sqlite-database-path.ts"));
  assert.match(backup, /PRAGMA integrity_check/);
  assert.doesNotMatch(backup, /cp\s+"\$DB_PATH"/);
  assert.match(restore, /pm2 save/);
  assert.match(restore, /Failed to start previous release/);
  assert.match(rollback, /id -u/);
  assert.match(healthRoute, /export async function GET/);
  assert.match(healthRoute, /export const dynamic\s*=\s*["']force-dynamic["']/);

  assert.match(readme, /device-session-v1/);
  assert.match(readme, /全部账号.*退出.*一次/);
  assert.match(readme, /后续.*不会.*退出/);
  assert.match(readme, /npm run devices:migrate/);
  assert.match(readme, /node_modules\/\.prisma/);
  assert.match(readme, /sudo pm2 pid student-management/);
  assert.match(readme, /sudo ps -o user=/);
  assert.match(readme, /-name "\$DB_NAME-journal"/);
  assert.match(readme, /-exec chmod u\+rw \{\} \+/);
  assert.match(readme, /sqlite3 "\$DB_PATH" ['"]PRAGMA integrity_check;/);
  assert.doesNotMatch(readme, /sudo -E/);
  assert.match(readme, /sudo env REPO_URL=/);
  assert.match(readme, /sudo env -u DATABASE_URL bash -lc ['"]cd \/opt\/student-management\/current && npm run devices:migrate/);
  assert.match(readme, /sudo env -u DATABASE_URL APP_ROOT=\/opt\/student-management APP_NAME=student-management PORT=3001 bash \/opt\/student-management\/current\/deploy\/rollback\.sh/);
  assert.match(readme, /旧进程.*无设备.*新版.*拒绝/);
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /健康检查.*失败.*恢复/);
});
