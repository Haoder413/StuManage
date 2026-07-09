import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const schedulePage = read("src/app/schedule/page.tsx");
const attendanceRoute = read("src/app/api/attendance/route.ts");
const progressRoute = read("src/app/api/progress/route.ts");
const progressPage = read("src/app/progress/students/[id]/page.tsx");
const courseOutlineEditor = read("src/app/courses/[id]/course-outline-editor.tsx");

assert.match(schedulePage, /reviewKnowledgePoints/, "attendance review dialog should keep knowledge point progress state");
assert.match(schedulePage, /loadStudentPendingKnowledgePoints/, "attendance review dialog should load pending knowledge points");
assert.match(schedulePage, /knowledgePointProgressUpdates/, "attendance save should submit knowledge point progress updates");
assert.match(schedulePage, /status !== "mastered"/, "attendance dialog should only show not-yet-learned knowledge points");
assert.match(schedulePage, /已学习/, "attendance dialog should use the learned status label");
assert.match(schedulePage, /buildKnowledgePointProgressTree/, "attendance dialog should build a tree from course knowledge points");
assert.match(schedulePage, /expandedKnowledgePointIds/, "attendance dialog should track expanded chapter nodes");
assert.match(schedulePage, /toggleKnowledgePointExpanded/, "attendance dialog should expand and collapse chapter titles");
assert.match(schedulePage, /renderKnowledgePointProgressNode/, "attendance dialog should render knowledge points recursively");
assert.match(schedulePage, /point\.children\.length > 0/, "attendance dialog should treat nodes with children as expandable titles");

assert.match(attendanceRoute, /knowledgePointProgressUpdates/, "attendance API should accept knowledge point progress updates");
assert.match(attendanceRoute, /studentKpProgress\.upsert/, "attendance API should upsert knowledge point progress inside the attendance transaction");
assert.match(attendanceRoute, /status === "mastered"/, "attendance API should mark selected knowledge points as learned");

assert.match(progressRoute, /course:\s*{\s*select:\s*{\s*id:\s*true,\s*name:\s*true/s, "progress API should include course labels for attendance grouping");
assert.match(progressPage, /学习中[\s\S]*已学习/, "teacher progress page should use the two-state knowledge point wording");
assert.doesNotMatch(progressPage, /未开始[\s\S]*已掌握[\s\S]*未开始/, "teacher progress page should no longer cycle through three knowledge point states");

assert.match(courseOutlineEditor, /addPoint\(null\)/, "course outline editor should allow adding root knowledge points directly");
assert.match(courseOutlineEditor, /新增知识点/, "course outline editor should show a root add knowledge point action");

console.log("attendance knowledge progress checks passed");
