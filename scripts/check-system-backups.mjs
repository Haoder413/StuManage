import { existsSync, readFileSync } from "node:fs";

const missing = [];

function requireFile(file, snippets) {
  if (!existsSync(file)) {
    missing.push(file);
    return;
  }
  const text = readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

requireFile("deploy/backup-db.sh", [
  "KEEP_BACKUPS=\"${KEEP_BACKUPS:-15}\"",
  "DB_PATH=\"${DB_PATH:-$APP_ROOT/shared/dev.db}\"",
  "BACKUP_DIR=\"${BACKUP_DIR:-$APP_ROOT/backups}\"",
  "dev-$(date +%Y%m%d-%H%M%S).db",
  "tail -n +$((KEEP_BACKUPS + 1))",
]);

requireFile("deploy/server-init.sh", [
  "/etc/cron.d/$APP_NAME-backup",
  "KEEP_BACKUPS=15",
  "backup-db.sh",
  "0 3 * * *",
]);

requireFile("deploy/deploy-update.sh", [
  "KEEP_BACKUPS=\"${KEEP_BACKUPS:-15}\"",
  "tail -n +$((KEEP_BACKUPS + 1))",
]);

requireFile("src/lib/database-backups.ts", [
  "KEEP_BACKUPS = 15",
  "listDatabaseBackups",
  "createDatabaseBackup",
  "cleanupOldBackups",
  "dev-",
]);

if (missing.length > 0) {
  console.error(`Missing system backup snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("System backup shape is present.");
