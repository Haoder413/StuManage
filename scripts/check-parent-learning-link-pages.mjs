import { readFileSync } from "node:fs";

const files = {
  "src/lib/parent-data.ts": ["learningLinks", "selectedLinkId", "getParentStudents(user)", "teacher", "subject"],
  "src/app/parent/page.tsx": ["getParentStudents", "孩子首页"],
  "src/app/parent/lessons/page.tsx": ["getParentStudents", "上课记录"],
  "src/app/parent/exams/page.tsx": ["getParentStudents", "成绩记录"],
  "src/app/parent/progress/page.tsx": ["getParentStudents", "学习进度"],
  "src/app/api/attendance/route.ts": ["findLearningLinkForTeacherStudent", "learningLinkId"],
  "src/app/api/progress/route.ts": ["findLearningLinkForTeacherStudent", "learningLinkId"],
  "src/app/api/weak-points/route.ts": ["findLearningLinkForTeacherStudent", "learningLinkId"],
};

const forbidden = {
  "src/app/parent/page.tsx": ["学习关系", "selectedLinkId", "data-learning-link-id"],
  "src/app/parent/lessons/page.tsx": ["学习关系", "selectedLinkId", "data-learning-link-id"],
  "src/app/parent/exams/page.tsx": ["学习关系", "selectedLinkId", "data-learning-link-id"],
  "src/app/parent/progress/page.tsx": ["学习关系", "selectedLinkId", "data-learning-link-id"],
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

for (const [file, snippets] of Object.entries(forbidden)) {
  const text = readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (text.includes(snippet)) missing.push(`${file} should not include: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing parent learning-link snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent learning-link pages are present.");
