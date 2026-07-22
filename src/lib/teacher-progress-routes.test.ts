import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("course options are limited by student visibility, active enrollment, and teacher course visibility", () => {
  const source = read("src/app/api/progress/courses/route.ts");
  assert.match(source, /visibleProgressStudentByIdWhere\(user, studentId\)/);
  assert.match(source, /status:\s*"active"/);
  assert.match(source, /course:\s*visibleProgressCourseWhere\(user\)/);
  assert.match(source, /sortTeacherProgressCourses/);
  assert.match(source, /viewerId:\s*user\.id/);
});

test("progress reads validate an explicit course and scope real plus synthetic rows", () => {
  const source = read("src/app/api/progress/route.ts");
  assert.match(source, /searchParams\.get\("courseId"\)/);
  assert.match(source, /studentCourse\.findFirst/);
  assert.match(source, /course:\s*visibleProgressCourseWhere\(user\)/);
  assert.match(source, /courseId:\s*selectedCourseId/);
  assert.match(source, /status:\s*"not_started"/);
});

test("progress writes validate the knowledge point course and active student enrollment", () => {
  const source = read("src/app/api/progress/route.ts");
  assert.match(source, /knowledgePoint\.findFirst/);
  assert.match(source, /course:\s*visibleProgressCourseWhere\(user\)/);
  assert.match(source, /studentCourse\.findFirst/);
  assert.match(source, /courseId:\s*changedKnowledgePoint\.courseId/);
  assert.match(source, /teacherSubjectMatches/);
});

test("student progress detail loads one selected course and remembers it per teacher and student", () => {
  const source = read("src/app/progress/students/[id]/page.tsx");
  assert.match(source, /\/api\/progress\/courses\?studentId=/);
  assert.match(source, /courseId=\$\{encodeURIComponent\(courseId\)\}/);
  assert.match(source, /teacher-progress-course:\$\{viewerId\}:\$\{studentId\}/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /selectedProgressScopeRef\.current !== requestScope/);
  assert.match(source, /notStartedCount/);
  assert.match(source, /暂无可查看的课程，请检查课程分配/);
  assert.doesNotMatch(source, /全部课程/);
});

test("progress overview uses visible courses and separates learning from not started", () => {
  const source = read("src/app/progress/page.tsx");
  assert.match(source, /visibleProgressCourseWhere\(user\)/);
  assert.match(source, /summarizeTeacherProgress/);
  assert.match(source, /calculateConsistentTeacherProgressStatuses/);
  assert.match(source, /activeCourseIds/);
  assert.match(source, /knowledgePoint:\s*\{\s*select:\s*\{\s*courseId:\s*true/);
  assert.match(source, /学习中/);
  assert.match(source, /未开始/);
  assert.doesNotMatch(source, /totalKps\s*-\s*mastered/);
});

test("progress pages and weak points use subject-scoped student visibility", () => {
  const overview = read("src/app/progress/page.tsx");
  const coursesRoute = read("src/app/api/progress/courses/route.ts");
  const progressRoute = read("src/app/api/progress/route.ts");
  const weakPointsRoute = read("src/app/api/weak-points/route.ts");
  assert.match(overview, /visibleProgressStudentWhere\(user\)/);
  assert.match(overview, /visibleProgressWeakPointWhere\(user\)/);
  assert.match(coursesRoute, /visibleProgressStudentByIdWhere\(user, studentId\)/);
  assert.match(progressRoute, /visibleProgressStudentByIdWhere/);
  assert.match(weakPointsRoute, /visibleProgressWeakPointWhere/);
  assert.match(weakPointsRoute, /teacherSubjectMatches/);
});
