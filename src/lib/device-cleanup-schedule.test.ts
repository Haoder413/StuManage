import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanupOldDeviceHistory, deviceHistoryCutoff } from "./device-session";
import { loadEnvFile } from "./env-file";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const cleanupScript = readFileSync(new URL("../../scripts/cleanup-device-history.ts", import.meta.url), "utf8");
const cronInstaller = readFileSync(new URL("../../deploy/install-maintenance-cron.sh", import.meta.url), "utf8");
const serverInit = readFileSync(new URL("../../deploy/server-init.sh", import.meta.url), "utf8");
const deployReadme = readFileSync(new URL("../../deploy/README.md", import.meta.url), "utf8");

test("cleanup returns the database deleted count and preserves the 90-day cutoff", async () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  let receivedCutoff: Date | null = null;
  const deleted = await cleanupOldDeviceHistory(
    {
      async cleanupDeviceHistory(input) {
        receivedCutoff = input.cutoff;
        return 3;
      },
    },
    now,
  );
  assert.equal(deleted, 3);
  assert.deepEqual(receivedCutoff, deviceHistoryCutoff(now));
});

test("npm cleanup command reports count, marks failure, and always disconnects", () => {
  assert.equal(
    packageJson.scripts["devices:cleanup"],
    "node --import tsx scripts/cleanup-device-history.ts",
  );
  assert.match(cleanupScript, /loadEnvFile\s*\(\s*["']\.env["']\s*\)/);
  assert.match(cleanupScript, /import\s*\(/);
  assert.ok(cleanupScript.indexOf('loadEnvFile(".env")') < cleanupScript.indexOf('import("../src/lib/device-session")'));
  assert.match(cleanupScript, /cleanupOldDeviceHistory\s*\(/);
  assert.match(cleanupScript, /deleted/i);
  assert.match(cleanupScript, /process\.exitCode\s*=\s*1/);
  assert.match(cleanupScript, /finally/);
  assert.match(cleanupScript, /prisma\.\$disconnect\s*\(/);
  assert.doesNotMatch(cleanupScript, /cleanupOldDeviceHistory\([^)]*\)\.catch\s*\(\s*\(\)\s*=>/);
});

test("loads quoted env values without overwriting inherited variables", () => {
  const directory = mkdtempSync(join(tmpdir(), "device-env-"));
  const path = join(directory, ".env");
  writeFileSync(path, '# comment\nDATABASE_URL="file:/tmp/example.db" # kept inside quotes\nNODE_ENV=production # inline comment\nSINGLE=\'quoted value\'\nEXISTING=file-value\n');
  const target: Record<string, string | undefined> = { EXISTING: "inherited" };
  loadEnvFile(path, target);
  assert.deepEqual(target, {
    DATABASE_URL: "file:/tmp/example.db",
    NODE_ENV: "production",
    SINGLE: "quoted value",
    EXISTING: "inherited",
  });
  assert.throws(() => loadEnvFile(join(directory, "missing.env"), {}), /ENOENT/);
});

test("maintenance installer is root-only, configurable, and writes a daily cron without secrets", () => {
  assert.match(cronInstaller, /id -u/);
  assert.match(cronInstaller, /APP_ROOT="\$\{APP_ROOT:-\/opt\/student-management\}"/);
  assert.match(cronInstaller, /APP_NAME="\$\{APP_NAME:-student-management\}"/);
  assert.match(cronInstaller, /CRON_DIR="\$\{CRON_DIR:-\/etc\/cron\.d\}"/);
  assert.match(cronInstaller, /CRON_FILE="\$CRON_DIR\/\$\{APP_NAME\}-maintenance"/);
  assert.match(cronInstaller, /PATH=\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/);
  assert.match(cronInstaller, /30 3 \* \* \* root cd \$APP_ROOT\/current && env -u DATABASE_URL npm run devices:cleanup/);
  assert.match(cronInstaller, /\$APP_ROOT\/backups\/device-cleanup\.log/);
  assert.match(cronInstaller, /apt-get install -y cron/);
  assert.match(cronInstaller, /systemctl enable --now cron/);
  assert.match(cronInstaller, /systemctl is-active --quiet cron/);
  assert.match(cronInstaller, /env -u DATABASE_URL npm run devices:cleanup/);
  assert.doesNotMatch(cronInstaller, /(?:cat|source|\.)\s+[^\n]*\.env/);
});

function writeCommandStub(directory: string, name: string, body: string) {
  const path = join(directory, name);
  writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(path, 0o755);
}

test("cron installer is idempotent, enables cron, and fails when immediate cleanup fails", () => {
  const directory = mkdtempSync(join(tmpdir(), "device-cron-"));
  const bin = join(directory, "bin");
  const appRoot = join(directory, "app");
  const cronDir = join(directory, "cron.d");
  const calls = join(directory, "calls.log");
  mkdirSync(bin);
  mkdirSync(join(appRoot, "current"), { recursive: true });
  writeCommandStub(bin, "id", 'echo "0"');
  writeCommandStub(bin, "apt-get", `echo "apt-get $*" >> "${calls}"`);
  writeCommandStub(bin, "systemctl", `echo "systemctl $*" >> "${calls}"`);
  writeCommandStub(bin, "npm", `echo "npm $*" >> "${calls}"; exit "\${FAIL_CLEANUP:-0}"`);
  const env = {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    APP_ROOT: appRoot,
    APP_NAME: "test-app",
    CRON_DIR: cronDir,
  };
  const installerPath = fileURLToPath(new URL("../../deploy/install-maintenance-cron.sh", import.meta.url));

  execFileSync("bash", [installerPath], { env });
  const firstCron = readFileSync(join(cronDir, "test-app-maintenance"), "utf8");
  execFileSync("bash", [installerPath], { env });
  assert.equal(readFileSync(join(cronDir, "test-app-maintenance"), "utf8"), firstCron);
  const commandCalls = readFileSync(calls, "utf8");
  assert.match(commandCalls, /apt-get install -y cron/);
  assert.match(commandCalls, /systemctl enable --now cron/);
  assert.match(commandCalls, /systemctl is-active --quiet cron/);
  assert.match(commandCalls, /npm run devices:cleanup/);
  assert.throws(() =>
    execFileSync("bash", [installerPath], {
      env: { ...env, FAIL_CLEANUP: "1" },
      stdio: "pipe",
    }),
  );
});

test("initial server setup installs maintenance cron and docs cover existing servers", () => {
  const deployIndex = serverInit.indexOf("deploy-update.sh");
  const maintenanceIndex = serverInit.indexOf("install-maintenance-cron.sh");
  assert.ok(deployIndex >= 0 && maintenanceIndex > deployIndex);
  assert.match(deployReadme, /sudo bash deploy\/install-maintenance-cron\.sh/);
  assert.match(deployReadme, /cat \/etc\/cron\.d\/student-management-maintenance/);
  assert.match(serverInit, /TRUST_PROXY_HEADERS="true"/);
  assert.match(serverInit, /proxy_set_header X-Real-IP \\\$remote_addr/);
  assert.match(serverInit, /proxy_set_header X-Forwarded-Proto \\\$scheme/);
  assert.match(deployReadme, /TRUST_PROXY_HEADERS="true"/);
});

test("backup script resolves the shared env database and verifies a consistent copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "device-backup-"));
  const appRoot = join(directory, "app");
  const current = join(appRoot, "current");
  const backupDirectory = join(appRoot, "backups");
  const customDatabase = join(appRoot, "shared", "custom.sqlite");
  const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
  mkdirSync(join(appRoot, "shared"), { recursive: true });
  mkdirSync(current, { recursive: true });
  symlinkSync(join(projectRoot, "scripts"), join(current, "scripts"));
  symlinkSync(join(projectRoot, "src"), join(current, "src"));
  symlinkSync(join(projectRoot, "node_modules"), join(current, "node_modules"));
  writeFileSync(join(current, ".env"), `DATABASE_URL="file:${customDatabase}"\nDEEPSEEK_API_KEY="must-not-print"\n`);
  execFileSync("sqlite3", [customDatabase, "CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('kept');"]);

  const output = execFileSync("bash", [fileURLToPath(new URL("../../deploy/backup-db.sh", import.meta.url))], {
    env: {
      ...process.env,
      DATABASE_URL: "file:/tmp/malicious-shell-database.sqlite",
      APP_ROOT: appRoot,
      APP_DIR: current,
      BACKUP_DIR: backupDirectory,
    },
    encoding: "utf8",
  });
  assert.doesNotMatch(output, /must-not-print/);
  const backupPath = join(backupDirectory, readdirSync(backupDirectory)[0]);
  assert.equal(execFileSync("sqlite3", [backupPath, "SELECT value FROM sample;"], { encoding: "utf8" }).trim(), "kept");
  assert.equal(execFileSync("sqlite3", [backupPath, "PRAGMA integrity_check;"], { encoding: "utf8" }).trim(), "ok");
});

test("failed previous-release start is explicit and never reports restored success", () => {
  const directory = mkdtempSync(join(tmpdir(), "device-restore-"));
  const bin = join(directory, "bin");
  const appRoot = join(directory, "app");
  const previous = join(appRoot, "releases", "previous");
  mkdirSync(bin);
  mkdirSync(previous, { recursive: true });
  writeCommandStub(bin, "pm2", `
if [ "\${1:-}" = "describe" ]; then exit 1; fi
if [ "\${1:-}" = "start" ]; then echo "simulated start failure" >&2; exit 7; fi
exit 0`);

  const result = spawnSync("bash", [fileURLToPath(new URL("../../deploy/restore-release.sh", import.meta.url))], {
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      APP_ROOT: appRoot,
      APP_NAME: "test-app",
      PREVIOUS_RELEASE: previous,
      PORT: "3001",
    },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /Failed to start previous release/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Previous release restored/);
});
