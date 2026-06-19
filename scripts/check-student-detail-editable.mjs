import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const studentRoute = readFileSync("src/app/api/students/route.ts", "utf8");
const communicationRoute = readFileSync("src/app/api/communication/route.ts", "utf8");
const studentPage = readFileSync("src/app/students/[id]/page.tsx", "utf8");
const editablePath = "src/app/students/[id]/student-detail-editor.tsx";
const editableSource = existsSync(editablePath) ? readFileSync(editablePath, "utf8") : "";

assert.match(studentRoute, /export async function PATCH/, "students API should support editing existing student info");
assert.match(communicationRoute, /export async function PATCH/, "communication API should support editing existing logs");
assert.match(studentPage, /StudentDetailEditor/, "student detail page should render editable student sections");
assert.match(editableSource, /编辑基本信息/, "student detail editor should expose basic info editing");
assert.match(editableSource, /编辑沟通记录/, "student detail editor should expose communication log editing");
assert.match(editableSource, /fetch\("\/api\/students"/, "student detail editor should save student edits through API");
assert.match(editableSource, /fetch\("\/api\/communication"/, "student detail editor should save communication edits through API");

console.log("Student detail editable sections are present.");
