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

requireFile("src/app/settings/page.tsx", ["requireCurrentUser", "SettingsClient", "role={user.role}"]);
requireFile("src/components/settings-client.tsx", [
  "修改密码",
  "数据库备份",
  "立即备份",
  "/api/account/password",
  "/api/system/backups",
  "role === \"admin\"",
]);
requireFile("src/app/api/system/backups/route.ts", [
  "requireAdmin",
  "listDatabaseBackups",
  "createDatabaseBackup",
  "GET",
  "POST",
]);

if (missing.length > 0) {
  console.error(`Missing settings page snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Settings page shape is present.");
