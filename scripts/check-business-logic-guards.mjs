import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

const schema = read("prisma/schema.prisma");
const schedulesRoute = read("src/app/api/schedules/route.ts");
const attendanceRoute = read("src/app/api/attendance/route.ts");
const resourceAccess = read("src/lib/resource-access.ts");
const parentData = read("src/lib/parent-data.ts");
const progressRoute = read("src/app/api/progress/route.ts");
const studentsRoute = read("src/app/api/students/route.ts");

assert.match(
  schedulesRoute,
  /validateScheduleRelations/,
  "schedules API should validate student/course relation before writing"
);
assert.match(
  schedulesRoute,
  /studentCourse\.findFirst/,
  "schedules API should require the selected student to be active in the selected course"
);

assert.match(
  attendanceRoute,
  /ensureTeacherCanUseLearningLink/,
  "attendance API should validate provided learningLinkId against the current teacher"
);
assert.match(
  attendanceRoute,
  /learningLink\.studentId !== String\(data\.studentId/,
  "attendance API should reject learning links for a different student"
);
assert.match(
  attendanceRoute,
  /where: \{ id: data\.studentId, workspaceId: user\.workspaceId \}/,
  "attendance API should verify standalone schedule students belong to the workspace"
);

assert.match(
  resourceAccess,
  /action: "preview" \| "download"/,
  "resource access should branch on preview/download action"
);
assert.match(
  resourceAccess,
  /canDownload/,
  "resource access should honor per-user download grants"
);
assert.match(
  resourceAccess,
  /learningLinks/,
  "resource course grants should be scoped through active parent learning links"
);

assert.doesNotMatch(
  parentData,
  /: await getParentStudents\(user\)/,
  "parent learning data should not fall back to all parent-student data without a selected learning link"
);

assert.match(
  progressRoute,
  /progressKey\(item\.studentId, item\.knowledgePointId, item\.learningLinkId/,
  "progress synthetic records should de-duplicate by learning link as well as student and knowledge point"
);
assert.match(
  schema,
  /@@unique\(\[studentId, knowledgePointId, learningLinkId\]\)/,
  "student progress should have a uniqueness rule aligned with student, knowledge point, and learning link"
);

assert.match(
  studentsRoute,
  /totalLessonHours: data\.totalLessonHours !== undefined/,
  "student PATCH should save edited total lesson hours"
);
assert.match(
  studentsRoute,
  /remainingLessonHours: data\.remainingLessonHours !== undefined/,
  "student PATCH should save edited remaining lesson hours"
);

console.log("Business logic guard checks passed.");
