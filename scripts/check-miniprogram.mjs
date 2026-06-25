import { readFileSync } from "node:fs";

const required = {
  "src/lib/auth.ts": ["createSessionToken", "SESSION_COOKIE"],
  "src/lib/mobile-auth.ts": ["getMobileCurrentUser", "Authorization", "Bearer"],
  "src/lib/mobile-parent-data.ts": ["getMobileParentHome", "getMobileParentExams", "getMobileParentProgress", "getMobileResources"],
  "src/app/api/mobile/auth/login/route.ts": ["POST", "verifyPassword", "token"],
  "src/app/api/mobile/parent/home/route.ts": ["GET", "getMobileParentHome"],
  "src/app/api/mobile/parent/exams/route.ts": ["GET", "getMobileParentExams"],
  "src/app/api/mobile/parent/progress/route.ts": ["GET", "getMobileParentProgress"],
  "src/app/api/mobile/resources/route.ts": ["GET", "getMobileResources"],
  "miniprogram/app.json": ["pages/login/index", "pages/home/index", "tabBar"],
  "miniprogram/app.js": ["globalData", "apiBaseUrl"],
  "miniprogram/utils/api.js": ["request", "Authorization", "Bearer"],
  "miniprogram/pages/login/index.js": ["login", "identifier", "password"],
  "miniprogram/pages/home/index.js": ["parent/home"],
  "miniprogram/pages/exams/index.js": ["parent/exams"],
  "miniprogram/pages/progress/index.js": ["parent/progress"],
  "miniprogram/pages/resources/index.js": ["resources"],
};

const missing = [];

for (const [file, snippets] of Object.entries(required)) {
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
  console.error(`Missing mini program snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program MVP structure is present.");
