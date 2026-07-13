import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const studentRoute = readFileSync("src/app/api/students/route.ts", "utf8");
const studentPage = readFileSync("src/app/students/[id]/page.tsx", "utf8");
const editablePath = "src/app/students/[id]/student-detail-editor.tsx";
const editableSource = existsSync(editablePath) ? readFileSync(editablePath, "utf8") : "";

assert.match(studentRoute, /export async function PATCH/, "students API should support editing existing student info");
assert.match(studentPage, /StudentDetailEditor/, "student detail page should render editable student sections");
assert.match(editableSource, /编辑基本信息/, "student detail editor should expose basic info editing");
assert.match(editableSource, /fetch\("\/api\/students"/, "student detail editor should save student edits through API");

console.log("Student detail editable sections are present.");
