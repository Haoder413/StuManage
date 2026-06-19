import { readFileSync } from "node:fs";

const files = {
  "src/app/parent/layout.tsx": ["ParentSidebar", "children"],
  "src/components/parent-sidebar.tsx": ["孩子首页", "上课记录", "成绩记录", "学习进度", "/parent/lessons", "/parent/exams", "/parent/progress"],
  "src/lib/parent-data.ts": ["getParentStudents", "parentId: user.id", "workspaceId: user.workspaceId"],
  "src/app/parent/page.tsx": ["孩子概览", "最近上课", "最近成绩", "课程安排"],
  "src/app/parent/lessons/page.tsx": ["上课记录", "lessonContent", "lessonFeedback", "parseTags"],
  "src/app/parent/exams/page.tsx": ["成绩记录", "平均得分率", "totalScore"],
  "src/app/parent/progress/page.tsx": ["学习进度", "知识点进度", "薄弱点复习"],
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
  console.error(`Missing parent portal snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent portal structure is present.");
