import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const examsRoute = readFileSync("src/app/api/exams/route.ts", "utf8");
const examsPage = readFileSync("src/app/exams/page.tsx", "utf8");
const newExamPage = readFileSync("src/app/exams/new/page.tsx", "utf8");
const studentExamPage = readFileSync("src/app/exams/students/[id]/page.tsx", "utf8");
const weakPointDialog = readFileSync("src/components/exam-weak-point-dialog.tsx", "utf8");

assert.match(examsRoute, /if \(data\.type !== undefined\) updateData\.type = data\.type/, "exam PATCH should update exam type");
assert.match(examsRoute, /if \(data\.name !== undefined\) updateData\.name = String\(data\.name/, "exam PATCH should update exam name");
assert.match(examsRoute, /weakPointDescriptions/, "exam POST should accept weak point descriptions");

assert.match(weakPointDialog, /export function ExamWeakPointDialog/, "shared weak point dialog should be exported");
assert.match(weakPointDialog, /搜索标签/, "shared weak point dialog should match review dialog search UX");
assert.match(weakPointDialog, /新增标签/, "shared weak point dialog should match review dialog add-tag UX");

assert.match(examsPage, /ExamWeakPointDialog/, "review page should use the shared weak point dialog");
assert.match(newExamPage, /ExamWeakPointDialog/, "new exam page should open weak point dialog before saving");
assert.doesNotMatch(newExamPage, /关联薄弱点/, "new exam page should not use inline free-text weak point input");
assert.match(newExamPage, /pendingSubmit/, "new exam page should keep pending scores while weak points are selected");
assert.match(studentExamPage, /ExamWeakPointDialog/, "student exam detail should open weak point dialog before saving a teacher-entered score");
assert.match(studentExamPage, /editForm/, "student exam detail should edit full exam metadata");
assert.match(studentExamPage, /name: editForm\.name/, "student exam detail should submit edited exam name");
assert.match(studentExamPage, /type: editForm\.type/, "student exam detail should submit edited exam type");

console.log("Exam editing and teacher weak-point dialog flow are present.");
