import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const examsPage = readFileSync("src/app/exams/page.tsx", "utf8");

assert.match(examsPage, /fetch\("\/api\/students"\)/, "exams page should load all students");
assert.match(examsPage, /Promise\.all/, "exams page should merge students and exams");
assert.match(examsPage, /students\.map/, "exams stats should be based on every student, not only students with exams");
assert.match(examsPage, /examCount: formal\.length/, "exam stats should still calculate existing exam counts");
assert.match(examsPage, /latestScore: scores\.length > 0/, "students without exams should have safe empty-score stats");

console.log("Exams page includes all students.");
