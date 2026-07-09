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
assert.match(kpRoute, /deleteKnowledgePoints/, "knowledge point API should support batch deleting nodes");
assert.match(kpRoute, /data\.ids/, "knowledge point API should accept a list of ids for batch delete");
assert.match(editor, /新增子知识点/, "outline editor should support adding child knowledge points");
assert.match(editor, /新增知识点/, "outline editor should support adding root knowledge points");
assert.match(editor, /批量导入/, "outline editor should support bulk paste import");
assert.match(editor, /批量删除/, "outline editor should support bulk delete");
assert.match(editor, /selectedKnowledgePointIds/, "outline editor should track selected nodes for bulk delete");
assert.match(editor, /parseOutlineText/, "outline editor should parse pasted tree outlines");
assert.match(editor, /粘贴知识点大纲/, "outline editor should provide a paste dialog");
assert.match(editor, /缩进比上一层更深就是子级/, "outline import help should explain flexible indentation rules");
assert.match(editor, /normalizeOutlineIndent/, "outline parser should normalize tabs and full-width spaces");
assert.match(editor, /stripOutlineInvisibleChars/, "outline parser should ignore invisible zero-width characters from pasted text");
assert.match(editor, /\\u200B-\\u200D/, "outline parser should strip zero-width character ranges");
assert.match(editor, /多级标题/, "outline import help should say multi-level titles are supported");
assert.match(editor, /重命名/, "outline editor should support renaming knowledge points");
assert.match(editor, /删除/, "outline editor should support deleting knowledge points");

console.log("Course outline editing is present.");
