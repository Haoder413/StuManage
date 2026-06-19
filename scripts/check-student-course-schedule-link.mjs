import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/students/new/page.tsx", "utf8");
const route = readFileSync("src/app/api/students/route.ts", "utf8");

assert.match(page, /fetch\("\/api\/courses"\)/, "new student page should load courses");
assert.match(page, /name="courseId"/, "new student page should submit selected course");
assert.match(page, /name="dayOfWeek"/, "new student page should submit fixed weekday");
assert.match(page, /name="startTime"/, "new student page should submit fixed start time");
assert.match(page, /name="endTime"/, "new student page should submit fixed end time");

assert.match(route, /studentCourses:\s*{/s, "student API should create a student-course link");
assert.match(route, /schedules:\s*hasSchedule \? {/s, "student API should create a fixed schedule");
assert.match(route, /type:\s*"fixed"/, "created schedule should be fixed");
