import { readFileSync } from "node:fs";

const files = {
  "deploy/server-init.sh": [
    "NODE_MAJOR=20",
    "npm install -g pm2",
    "deploy-update.sh",
    "DATABASE_URL",
  ],
  "deploy/deploy-update.sh": [
    "REPO_URL",
    "releases",
    "npm ci",
    "npx prisma db push",
    "npm run build",
    "pm2 delete",
    "cd \"$APP_ROOT/current\"",
    "pm2",
  ],
  "deploy/install-maintenance-cron.sh": [
    "id -u",
    "APP_ROOT",
    "devices:cleanup",
    "device-cleanup.log",
  ],
  "deploy/rollback.sh": [
    "releases",
    "current",
    "restore-release.sh",
  ],
  "deploy/restore-release.sh": [
    "PREVIOUS_RELEASE",
    "pm2 start",
    "pm2 save",
    "Previous release restored",
  ],
  "deploy/publish-repo.sh": [
    "REMOTE_URL",
    "git remote",
    "git push",
  ],
  "deploy/README.md": [
    "Ubuntu 22.04",
    "server-init.sh",
    "deploy-update.sh",
    "rollback.sh",
    "publish-repo.sh",
    "SQLite",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(files)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

const rootReadme = readFileSync("README.md", "utf8");
const deployReadme = readFileSync("deploy/README.md", "utf8");
const safeResourceMigration = `sudo env -u DATABASE_URL bash -lc '
  cd /opt/student-management/current &&
  test "$(readlink -f .env)" = /opt/student-management/shared/.env &&
  npx prisma db push --accept-data-loss &&
  npm run resources:migrate &&
  npm run resources:migrate
'`;

if (!rootReadme.includes(safeResourceMigration)) {
  missing.push("README.md: root resource migration must clear DATABASE_URL and verify shared .env");
}
if (
  !deployReadme.includes(
    "sudo env -u DATABASE_URL bash -lc 'cd /opt/student-management/current && npx prisma db push'",
  )
) {
  missing.push("deploy/README.md: manual Prisma sync must clear inherited DATABASE_URL");
}

for (const [file, text] of [
  ["README.md", rootReadme],
  ["deploy/README.md", deployReadme],
]) {
  const serverSection = file === "README.md" ? text.slice(text.indexOf("## 服务器部署")) : text;
  if (/sudo env (?!-u DATABASE_URL )[^\n]*rollback\.sh/.test(serverSection)) {
    missing.push(`${file}: rollback must clear inherited DATABASE_URL`);
  }
}

if (missing.length > 0) {
  console.error(`Missing deploy script snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Deploy scripts are present.");
