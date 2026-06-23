import { readFileSync, existsSync } from "node:fs";

const files = {
  "src/app/accounts/page.tsx": ["learningLinks", "teachingSubject", "teachers", "parents"],
  "src/app/accounts/account-manager.tsx": [
    "teachingSubject",
    "学习关系",
    "saveLearningLink",
    "selectedLearningLink",
    "isActive",
    "增加账号",
    "startCreateAccount",
  ],
  "src/app/api/accounts/route.ts": ["teachingSubject", "learningLinksAsParent", "learningLinksAsTeacher"],
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

if (!existsSync("src/app/api/learning-links/route.ts")) {
  missing.push("src/app/api/learning-links/route.ts");
} else {
  const route = readFileSync("src/app/api/learning-links/route.ts", "utf8");
  for (const snippet of ["requireAdmin", "POST", "PATCH", "teacher.teachingSubject", "isActive"]) {
    if (!route.includes(snippet)) missing.push(`src/app/api/learning-links/route.ts: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing learning-link admin snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Learning-link admin management shape is present.");
