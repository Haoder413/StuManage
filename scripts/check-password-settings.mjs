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

requireFile("src/app/api/account/password/route.ts", [
  "requireCurrentUser",
  "verifyPassword",
  "hashPassword",
  "clearSession",
  "newPassword.length < 6",
]);
requireFile("src/components/sidebar.tsx", ["系统设置", "/settings"]);
requireFile("src/components/parent-sidebar.tsx", ["账号设置", "/parent/settings"]);
requireFile("src/app/parent/settings/page.tsx", ["requireParent", "SettingsClient", "role={user.role}"]);

if (missing.length > 0) {
  console.error(`Missing password/settings snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Password settings shape is present.");
