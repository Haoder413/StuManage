import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
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
  writeFileSync(path, 'DATABASE_URL="file:/tmp/example.db"\nNODE_ENV=production\nEXISTING=file-value\n');
  const target: Record<string, string | undefined> = { EXISTING: "inherited" };
  loadEnvFile(path, target);
  assert.deepEqual(target, {
    DATABASE_URL: "file:/tmp/example.db",
    NODE_ENV: "production",
    EXISTING: "inherited",
  });
});

test("maintenance installer is root-only, configurable, and writes a daily cron without secrets", () => {
  assert.match(cronInstaller, /id -u/);
  assert.match(cronInstaller, /APP_ROOT="\$\{APP_ROOT:-\/opt\/student-management\}"/);
  assert.match(cronInstaller, /APP_NAME="\$\{APP_NAME:-student-management\}"/);
  assert.match(cronInstaller, /CRON_DIR="\$\{CRON_DIR:-\/etc\/cron\.d\}"/);
  assert.match(cronInstaller, /CRON_FILE="\$CRON_DIR\/\$\{APP_NAME\}-maintenance"/);
  assert.match(cronInstaller, /PATH=\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/);
  assert.match(cronInstaller, /30 3 \* \* \* root cd \$APP_ROOT\/current && npm run devices:cleanup/);
  assert.match(cronInstaller, /\$APP_ROOT\/backups\/device-cleanup\.log/);
  assert.match(cronInstaller, /apt-get install -y cron/);
  assert.match(cronInstaller, /systemctl enable --now cron/);
  assert.match(cronInstaller, /systemctl is-active --quiet cron/);
  assert.doesNotMatch(cronInstaller, /DATABASE_URL|\.env/);
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
});
