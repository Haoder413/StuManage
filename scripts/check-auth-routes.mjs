import { readFileSync } from "node:fs";

const files = {
  "middleware.ts": ["SESSION_COOKIE", "/login", "/api/auth"],
  "src/app/login/page.tsx": ["登录", "/api/auth/login", "账号", "密码"],
  "src/app/api/auth/login/route.ts": ["verifyPassword", "createSession", "redirectTo"],
  "src/app/api/auth/logout/route.ts": ["clearSession", "NextResponse"],
  "src/app/parent/page.tsx": ["requireParent", "parentStudents", "最近上课"],
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
  console.error(`Missing auth routes: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Auth routes and parent entry are present.");
