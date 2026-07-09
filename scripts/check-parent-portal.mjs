import { readFileSync } from "node:fs";

const files = {
  "src/app/parent/layout.tsx": ["ParentSidebar", "children", "pb-20", "md:pb-6", "md:ml-48"],
  "src/components/parent-sidebar.tsx": ["时间管理", "成绩记录", "学习进度", "/parent/lessons", "/parent/exams", "/parent/progress", "ParentMobileNav", "fixed", "inset-y-0", "hidden", "md:flex", "md:hidden"],
  "src/lib/parent-data.ts": ["getParentStudents", "parentId: user.id", "workspaceId: user.workspaceId"],
  "src/app/parent/page.tsx": ["redirect(\"/parent/progress\")"],
  "src/app/parent/lessons/page.tsx": ["时间管理", "ParentTimeManagementClient"],
  "src/components/parent-time-management-client.tsx": ["lessonContent", "lessonFeedback", "TeacherTagList"],
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

const parentSidebar = readFileSync("src/components/parent-sidebar.tsx", "utf8");
if (parentSidebar.includes("孩子首页") || parentSidebar.includes("sticky top-0")) {
  missing.push("src/components/parent-sidebar.tsx should use fixed parent navigation without child home");
}

if (missing.length > 0) {
  console.error(`Missing parent portal snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent portal structure is present.");
