import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const coursesRoute = readFileSync("src/app/api/courses/route.ts", "utf8");
const studentRoute = readFileSync("src/app/api/students/route.ts", "utf8");
const courseDetail = readFileSync("src/app/courses/[id]/page.tsx", "utf8");
const completeButton = readFileSync("src/app/courses/[id]/complete-course-button.tsx", "utf8");
const studentEditor = readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");

assert.match(schema, /model Course[\s\S]*status\s+String\s+@default\("active"\)[\s\S]*endedAt\s+DateTime\?/, "Course should track active/completed state");
assert.match(schema, /model StudentCourse[\s\S]*endDate\s+DateTime\?[\s\S]*endEvaluation\s+String\?/, "StudentCourse should store completion date and evaluation");

assert.doesNotMatch(coursesRoute, /studentId, status: "active", courseId: \{ not: courseId \}/, "adding a student to one course must not inactivate their other courses");
assert.doesNotMatch(studentRoute, /where: \{ workspaceId, studentId, status: "active" \}/, "student editing must not inactivate active courses");
assert.match(coursesRoute, /data\.action !== "complete"/, "courses API should support course completion");
assert.match(coursesRoute, /endEvaluation/, "course completion should save per-student evaluations");
assert.match(coursesRoute, /status: "completed"/, "course completion should mark course/student course records completed");

assert.match(courseDetail, /CompleteCourseButton/, "course detail should render the completion button");
assert.match(completeButton, /结课/, "completion UI should be labeled 结课");
assert.match(completeButton, /evaluations/, "completion UI should collect per-student evaluations");

assert.doesNotMatch(studentEditor, /选择课程/, "student editor should not show course selection");
assert.doesNotMatch(studentEditor, /studentForm\.courseId/, "student editor should not submit courseId");

console.log("Multiple active courses and completion checks passed.");
