import { readFileSync } from "node:fs";

const expectations = {
  "prisma/schema.prisma": [
    "createdById",
    "StudentsCreatedByTeacher",
    "createdStudents Student[]",
  ],
  "src/lib/teacher-visibility.ts": [
    "visibleStudentWhere",
    "visibleStudentByIdWhere",
    "teacherSeesAllWorkspaceData",
    "createdById: user.id",
    "learningLinks",
    "teacherId: user.id",
    "isActive: true",
  ],
  "src/app/api/students/route.ts": [
    "visibleStudentWhere",
    "visibleStudentByIdWhere",
    "deletableStudentByIdWhere",
    "createdById: user.role === \"teacher\" ? user.id : null",
  ],
  "src/app/students/page.tsx": [
    "visibleStudentWhere",
    "canDeleteStudent",
  ],
  "src/app/students/[id]/page.tsx": [
    "visibleStudentByIdWhere",
  ],
  "src/app/progress/page.tsx": [
    "visibleStudentWhere",
  ],
  "src/app/api/progress/route.ts": [
    "visibleStudentWhere",
    "visibleStudentByIdWhere",
  ],
  "src/app/api/weak-points/route.ts": [
    "visibleStudentWhere",
    "visibleStudentByIdWhere",
  ],
  "src/app/api/schedules/route.ts": [
    "visibleScheduleWhere",
    "visibleStudentByIdWhere",
  ],
  "src/app/api/attendance/route.ts": [
    "visibleScheduleWhere",
    "visibleStudentByIdWhere",
  ],
  "src/app/api/exams/route.ts": [
    "visibleStudentWhere",
    "visibleStudentByIdWhere",
  ],
  "docs/操作手册.md": [
    "教师数据隔离",
    "自己创建的学生",
    "有效学习关系",
  ],
  "docs/conversation-summary.md": [
    "教师数据隔离",
    "管理员绑定有效学习关系",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(expectations)) {
  let source = "";
  try {
    source = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing teacher data isolation snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Teacher data isolation guards are present.");
