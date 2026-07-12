import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/schedule/page.tsx", "utf8");

assert.match(source, /fetch\(`\/api\/progress\?studentId=\$\{encodeURIComponent\(studentId\)\}`\)/, "attendance dialog should load only the current student's progress");
assert.match(source, /existingMasteredKnowledgePointIds/, "attendance dialog should track persisted mastered knowledge points");
assert.match(source, /Boolean\(b\.learningLinkId\)/, "attendance dialog should prefer linked progress over legacy duplicates");
assert.match(source, /alreadyMastered \|\| selected/, "attendance dialog should display persisted and newly selected mastery");
assert.match(source, /calculateConsistentProgressStatuses/, "attendance dialog should derive parent status from child status");
assert.doesNotMatch(source, /\.filter\(\(items\) => items\.every\(\(item\) => item\.status !== "mastered"\)\)/, "attendance dialog should not remove mastered knowledge points");

console.log("Schedule progress status checks passed.");
