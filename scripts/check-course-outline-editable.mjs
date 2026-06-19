import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const coursePage = readFileSync("src/app/courses/[id]/page.tsx", "utf8");
const kpRoutePath = "src/app/api/knowledge-points/route.ts";
const editorPath = "src/app/courses/[id]/course-outline-editor.tsx";
const kpRoute = existsSync(kpRoutePath) ? readFileSync(kpRoutePath, "utf8") : "";
const editor = existsSync(editorPath) ? readFileSync(editorPath, "utf8") : "";

assert.match(coursePage, /href="\/courses"/, "course detail should include a back button to course list");
assert.match(coursePage, /CourseOutlineEditor/, "course detail should render editable outline component");
assert.match(coursePage, /选课学生/, "course detail should show students enrolled in this course");
assert.match(coursePage, /studentCourses/, "course detail should load course student enrollments");
assert.match(kpRoute, /export async function POST/, "knowledge point API should support adding nodes");
assert.match(kpRoute, /data\.items/, "knowledge point API should support batch importing nodes");
assert.match(kpRoute, /export async function PATCH/, "knowledge point API should support renaming nodes");
assert.match(kpRoute, /export async function DELETE/, "knowledge point API should support deleting nodes");
assert.match(editor, /新增子知识点/, "outline editor should support adding child knowledge points");
assert.match(editor, /批量导入/, "outline editor should support bulk paste import");
assert.match(editor, /parseOutlineText/, "outline editor should parse pasted tree outlines");
assert.match(editor, /粘贴知识点大纲/, "outline editor should provide a paste dialog");
assert.match(editor, /重命名/, "outline editor should support renaming knowledge points");
assert.match(editor, /删除/, "outline editor should support deleting knowledge points");
assert.doesNotMatch(editor, /onClick=\{\(\) => addPoint\(null\)\}>新增知识点/, "root add knowledge point button should be removed");

console.log("Course outline editing is present.");
