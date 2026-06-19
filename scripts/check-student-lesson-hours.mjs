import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const page = readFileSync("src/app/students/[id]/page.tsx", "utf8");
const editor = readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");
const route = readFileSync("src/app/api/students/route.ts", "utf8");
const attendanceRoute = readFileSync("src/app/api/attendance/route.ts", "utf8");

assert.match(schema, /totalLessonHours\s+Int\s+@default\(0\)/, "Student should store editable total lesson hours");
assert.match(schema, /remainingLessonHours\s+Int\s+@default\(0\)/, "Student should store editable remaining lesson hours");
assert.match(route, /totalLessonHours/, "students API should save total lesson hours");
assert.match(route, /remainingLessonHours/, "students API should save remaining lesson hours");
assert.match(editor, /总课时/, "student editor should expose total lesson hours");
assert.match(editor, /剩余课时/, "student editor should expose remaining lesson hours");
assert.match(page, /所属课程/, "student detail should show course names instead of course count");
assert.match(page, /课时统计/, "student detail should show lesson hour stats instead of exam count");
assert.match(page, /student\.remainingLessonHours/, "student detail should read stored remaining lesson hours");
assert.match(attendanceRoute, /remainingLessonHours/, "attendance should update remaining lesson hours");
assert.match(attendanceRoute, /existing\?\.status !== "present"/, "attendance should only decrement when status changes into present");
assert.doesNotMatch(page, />课程数</, "course count card label should be removed");
assert.doesNotMatch(page, />考试次数</, "exam count card label should be removed");

console.log("Student lesson hour stats are present.");
