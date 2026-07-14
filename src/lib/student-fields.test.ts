import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const api = readFileSync("src/app/api/students/route.ts", "utf8");
const editor = readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");
const newStudent = readFileSync("src/app/students/new/page.tsx", "utf8");

test("tuition is stored and submitted as text", () => {
  assert.match(schema, /tuition\s+String\?/);
  assert.doesNotMatch(api, /parseFloat\(data\.tuition\)/);
  assert.doesNotMatch(editor, /type="number"[^>]*value=\{studentForm\.tuition\}/);
  assert.doesNotMatch(newStudent, /name="tuition"[^>]*type="number"/);
});

test("lesson frequency is hidden from the basic information editor", () => {
  const dialogStart = editor.indexOf("<Dialog open={showStudentDialog}");
  const dialogEnd = editor.indexOf("<Dialog open={Boolean(lessonHourAction)}");
  const basicInfoDialog = editor.slice(dialogStart, dialogEnd);

  assert.doesNotMatch(basicInfoDialog, />上课频次</);
});
