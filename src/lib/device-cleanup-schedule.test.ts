import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { cleanupOldDeviceHistory, deviceHistoryCutoff } from "./device-session";

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
      async deleteOldInactiveDevices(cutoff) {
        receivedCutoff = cutoff;
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
    "node --env-file=.env --import tsx scripts/cleanup-device-history.ts",
  );
  assert.match(cleanupScript, /cleanupOldDeviceHistory\s*\(/);
  assert.match(cleanupScript, /deleted/i);
  assert.match(cleanupScript, /process\.exitCode\s*=\s*1/);
  assert.match(cleanupScript, /finally/);
  assert.match(cleanupScript, /prisma\.\$disconnect\s*\(/);
  assert.doesNotMatch(cleanupScript, /cleanupOldDeviceHistory\([^)]*\)\.catch\s*\(\s*\(\)\s*=>/);
});

test("maintenance installer is root-only, configurable, and writes a daily cron without secrets", () => {
  assert.match(cronInstaller, /id -u/);
  assert.match(cronInstaller, /APP_ROOT="\$\{APP_ROOT:-\/opt\/student-management\}"/);
  assert.match(cronInstaller, /APP_NAME="\$\{APP_NAME:-student-management\}"/);
  assert.match(cronInstaller, /\/etc\/cron\.d\/\$\{APP_NAME\}-maintenance/);
  assert.match(cronInstaller, /PATH=\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/);
  assert.match(cronInstaller, /30 3 \* \* \* root cd \$APP_ROOT\/current && npm run devices:cleanup/);
  assert.match(cronInstaller, /\$APP_ROOT\/backups\/device-cleanup\.log/);
  assert.doesNotMatch(cronInstaller, /DATABASE_URL|\.env/);
});

test("initial server setup installs maintenance cron and docs cover existing servers", () => {
  const deployIndex = serverInit.indexOf("deploy-update.sh");
  const maintenanceIndex = serverInit.indexOf("install-maintenance-cron.sh");
  assert.ok(deployIndex >= 0 && maintenanceIndex > deployIndex);
  assert.match(deployReadme, /sudo bash deploy\/install-maintenance-cron\.sh/);
  assert.match(deployReadme, /cat \/etc\/cron\.d\/student-management-maintenance/);
});
