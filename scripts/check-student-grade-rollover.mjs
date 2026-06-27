import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const gradeLib = readFileSync("src/lib/student-grades.ts", "utf8");
const studentsApi = readFileSync("src/app/api/students/route.ts", "utf8");
const studentsPage = readFileSync("src/app/students/page.tsx", "utf8");
const studentDetailPage = readFileSync("src/app/students/[id]/page.tsx", "utf8");
const studentEditor = readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");
const newStudentPage = readFileSync("src/app/students/new/page.tsx", "utf8");

assert.match(schema, /gradeRolloverYear\s+Int\s+@default\(0\)/, "Workspace should remember the latest completed grade rollover year");

assert.match(gradeLib, /STUDENT_GRADE_OPTIONS/, "grade helper should expose selectable grade options");
assert.match(gradeLib, /"初一"[\s\S]*"初二"[\s\S]*"初三"/, "grade options should include junior grades");
assert.match(gradeLib, /formatGraduatedGrade\(year: number\)/, "grade helper should format graduation labels");
assert.match(gradeLib, /\$\{year\}初中已毕业/, "graduation label should be like 2026初中已毕业");
assert.match(gradeLib, /rolloverStudentGradesForWorkspace/, "grade helper should provide workspace rollover");
assert.match(gradeLib, /month === 9 && day >= 1/, "rollover should start on September 1");
assert.match(gradeLib, /gradeRolloverYear: year/, "rollover should mark the workspace year after updating");

assert.match(studentsApi, /rolloverStudentGradesForWorkspace/, "students API should trigger grade rollover");
assert.match(studentsPage, /rolloverStudentGradesForWorkspace/, "students list should trigger grade rollover before reading students");
assert.match(studentDetailPage, /rolloverStudentGradesForWorkspace/, "student detail should trigger grade rollover before reading student");
assert.match(studentEditor, /STUDENT_GRADE_OPTIONS/, "student detail editor should use fixed grade options");
assert.match(newStudentPage, /STUDENT_GRADE_OPTIONS/, "new student page should use fixed grade options");
assert.doesNotMatch(studentEditor, /<Input value=\{studentForm\.grade\}/, "student detail grade should not be free text input");
assert.doesNotMatch(newStudentPage, /<Input id="grade"/, "new student grade should not be free text input");

console.log("Student grade options and September rollover are present.");
