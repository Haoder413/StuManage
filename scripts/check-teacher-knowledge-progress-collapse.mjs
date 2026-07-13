import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");

assert.match(page, /knowledgeProgressOpen, setKnowledgeProgressOpen\] = useState\(true\)/, "teacher knowledge progress should be open by default");
assert.match(page, /aria-expanded=\{knowledgeProgressOpen\}/, "knowledge progress toggle should expose its expanded state");
assert.match(page, /aria-controls="teacher-knowledge-progress-content"/, "knowledge progress toggle should identify the controlled content");
assert.match(page, /role="heading" aria-level=\{3\}/, "knowledge progress title should retain heading semantics");
assert.match(page, /setKnowledgeProgressOpen\(\(open\) => !open\)/, "knowledge progress header should toggle the section");
assert.match(page, /knowledgeProgressOpen \? "收起" : "展开"/, "knowledge progress header should label the toggle action");
assert.match(page, /\{knowledgeProgressOpen && \([\s\S]*?kpTree\.length === 0/, "knowledge progress content should render only while expanded");
assert.match(page, /id="teacher-knowledge-progress-content"/, "knowledge progress content should be linked to its toggle");

console.log("Teacher knowledge progress collapse checks passed.");
