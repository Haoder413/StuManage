import { readFileSync } from "node:fs";

const files = {
  "prisma/seed.ts": ["phone: \"admin\"", "role: \"admin\"", "admin123"],
  "src/lib/auth.ts": ["export async function requireAdmin", "user.role !== \"admin\"", "user.role !== \"admin\" && user.role !== \"teacher\" && user.role !== \"demo\""],
  "src/components/sidebar.tsx": ["账号管理", "/accounts", "useEffect"],
  "src/app/accounts/page.tsx": ["requireAdmin", "AccountManager", "账号管理"],
  "src/app/accounts/account-manager.tsx": ["parentStudentIds", "保存账号", "重置密码", "可见学生"],
  "src/app/api/accounts/route.ts": ["requireAdmin", "hashPassword", "parentStudents", "deleteMany", "createMany"],
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
  console.error(`Missing admin account management snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Admin account management shape is present.");
