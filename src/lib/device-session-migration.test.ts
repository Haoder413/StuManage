import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEVICE_SESSION_MIGRATION_KEY,
  type DeviceSessionMigrationDatabase,
  type DeviceSessionMigrationTransaction,
  migrateDeviceSessions,
} from "./device-session-migration";

class MemoryMigrationDatabase implements DeviceSessionMigrationDatabase {
  sessions: number;
  marker = false;
  createFailure: Error | null = null;
  publishMarkerAfterRollback = false;

  constructor(sessions: number) {
    this.sessions = sessions;
  }

  async findMigration(key: string): Promise<boolean> {
    assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
    return this.marker;
  }

  async transaction<T>(work: (tx: DeviceSessionMigrationTransaction) => Promise<T>): Promise<T> {
    const snapshot = { sessions: this.sessions, marker: this.marker };
    const tx: DeviceSessionMigrationTransaction = {
      findMigration: async (key) => {
        assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
        return this.marker;
      },
      clearSessions: async () => {
        const count = this.sessions;
        this.sessions = 0;
        return count;
      },
      createMigration: async (key) => {
        assert.equal(key, DEVICE_SESSION_MIGRATION_KEY);
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

test("migration CLI and deployment run the one-time migration in the safe order", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const cli = readFileSync("scripts/migrate-device-sessions.ts", "utf8");
  const deploy = readFileSync("deploy/deploy-update.sh", "utf8");
  const serverInit = readFileSync("deploy/server-init.sh", "utf8");
  const readme = readFileSync("README.md", "utf8");

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

  const schemaIndex = deploy.indexOf("npx prisma db push --skip-generate");
  const migrationIndex = deploy.indexOf("npm run devices:migrate");
  const buildIndex = deploy.indexOf("npm run build");
  const startIndex = deploy.indexOf("pm2 start");
  assert.ok(schemaIndex >= 0 && migrationIndex > schemaIndex);
  assert.ok(buildIndex > migrationIndex);
  assert.ok(startIndex > migrationIndex);
  assert.doesNotMatch(serverInit, /devices:migrate/);

  assert.match(readme, /device-session-v1/);
  assert.match(readme, /全部账号.*退出.*一次/);
  assert.match(readme, /后续.*不会.*退出/);
  assert.match(readme, /npm run devices:migrate/);
  assert.match(readme, /node_modules\/\.prisma/);
  assert.match(readme, /shared\/dev\.db/);
});
