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
  "deploy/rollback.sh": [
    "releases",
    "current",
    "pm2",
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

if (missing.length > 0) {
  console.error(`Missing deploy script snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Deploy scripts are present.");
