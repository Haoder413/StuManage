import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/students/new/page.tsx", "utf8");
const route = readFileSync("src/app/api/students/route.ts", "utf8");

assert.doesNotMatch(page, /fetch\("\/api\/courses"\)/, "new student page should not load courses");
assert.doesNotMatch(page, /选择课程/, "new student page should not show course selection");
assert.doesNotMatch(page, /courseId/, "new student page should not submit selected course");
assert.doesNotMatch(page, /name="dayOfWeek"/, "new student page should not submit fixed weekday");
assert.doesNotMatch(page, /name="startTime"/, "new student page should not submit fixed start time");
assert.doesNotMatch(page, /name="endTime"/, "new student page should not submit fixed end time");

assert.match(route, /syncStudentCourseAndSchedules/, "student API may keep optional course sync compatibility for other flows");
assert.match(route, /type:\s*"fixed"/, "created schedule should be fixed");

console.log("New student form no longer includes course selection.");
