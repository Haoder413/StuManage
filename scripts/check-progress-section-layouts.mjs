import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const teacherProgress = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const parentProgress = readFileSync("src/app/parent/progress/page.tsx", "utf8");
const parentSection = readFileSync("src/app/parent/progress/parent-progress-section.tsx", "utf8");

assert.match(teacherProgress, /BookOpen/, "teacher progress knowledge tree should use the same root icon style as course outline");
assert.match(teacherProgress, /Circle/, "teacher progress knowledge tree should use the same child icon style as course outline");
assert.match(teacherProgress, /outline-tree-connector/, "teacher progress knowledge tree should show outline connectors");
assert.match(teacherProgress, /renderKpNode/, "teacher progress should render knowledge points as a tree");
assert.match(teacherProgress, /parentId/, "teacher progress should preserve knowledge point hierarchy");

assert.match(parentProgress, /ParentProgressSection[\s\S]*title="薄弱点复习"[\s\S]*ParentProgressSection[\s\S]*title="知识点进度"/, "parent progress should show weak points before knowledge progress");
assert.match(parentProgress, /defaultOpen={false}/, "parent progress sections should default to collapsed");
assert.match(parentSection, /useState\(defaultOpen\)/, "parent progress section should keep local expand state");
assert.match(parentSection, /aria-expanded/, "parent progress section should expose expanded state");

console.log("Progress section layout checks passed.");
