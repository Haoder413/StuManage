import { readFileSync } from "node:fs";

const expectations = {
  "src/lib/resource-access.ts": [
    "visibleCourseWhere",
    "teacherSeesAllWorkspaceData",
    "uploadedById: user.id",
    "coursePermissions",
  ],
  "src/app/resources/page.tsx": [
    "visibleCourseWhere",
  ],
  "src/app/api/resources/route.ts": [
    "getVisibleResourceWhere(user)",
    "visibleCourseWhere",
  ],
  "src/app/api/resource-permissions/route.ts": [
    "getVisibleResourceWhere",
    "visibleCourseWhere",
  ],
  "src/components/resource-center.tsx": [
    "role === \"demo\"",
  ],
  "src/lib/homework-access.ts": [
    "visibleHomeworkAssignmentWhere",
    "visibleHomeworkAssignmentByIdWhere",
    "visibleCourseWhere",
    "visibleStudentWhere",
  ],
  "src/app/homework/page.tsx": [
    "visibleHomeworkAssignmentWhere",
    "visibleStudentWhere",
  ],
  "src/app/api/homework/route.ts": [
    "visibleHomeworkAssignmentWhere",
    "visibleCourseByIdWhere",
  ],
  "src/app/api/homework/[id]/route.ts": [
    "visibleHomeworkAssignmentByIdWhere",
    "visibleStudentWhere",
  ],
  "src/app/api/homework/[id]/submissions/[submissionId]/grade/route.ts": [
    "visibleHomeworkAssignmentByIdWhere",
    "visibleStudentWhere",
  ],
  "src/app/api/homework/files/[kind]/[id]/route.ts": [
    "visibleHomeworkAssignmentByIdWhere",
    "visibleStudentWhere",
  ],
  "src/app/homework/[id]/page.tsx": [
    "visibleHomeworkAssignmentByIdWhere",
    "visibleStudentWhere",
  ],
  "docs/操作手册.md": [
    "资料中心和作业批改也按教师数据隔离",
    "演示账号按演示工作区内的管理员/老师能力使用",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(expectations)) {
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
  console.error(`Missing resource/homework teacher isolation snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Resource and homework teacher isolation guards are present.");
