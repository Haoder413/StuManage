import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const students = readFileSync("src/app/students/page.tsx", "utf8");
const courses = readFileSync("src/app/courses/page.tsx", "utf8");
const exams = readFileSync("src/app/exams/page.tsx", "utf8");

assert.match(students, /glass-card/, "students page should use card layout");
assert.match(students, /lg:grid-cols-3/, "students page should use three cards per row on large screens");
assert.doesNotMatch(students, /<table/, "students page should not use a table list");

assert.match(courses, /glass-card/, "courses page should use card layout");
assert.match(courses, /lg:grid-cols-3/, "courses page should use three cards per row on large screens");
assert.doesNotMatch(courses, /<table/, "courses page should not use a table list");

assert.match(exams, /lg:grid-cols-3/, "exams page should match progress page three-card layout");

console.log("Management pages use card layouts.");
