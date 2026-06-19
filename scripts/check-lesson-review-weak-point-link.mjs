import { readFileSync } from "node:fs";

const schedulePage = readFileSync("src/app/schedule/page.tsx", "utf8");

const requiredSnippets = [
  'fetch("/api/weak-point-tags")',
  'fetch("/api/weak-points"',
  'fetch("/api/weak-point-tags",',
  'method: "POST"',
  "selectedWeakPointTags",
  "weakPointTags",
  "WeakPointTagChips",
  "selected={selectedWeakPointTags}",
  "onToggle={(name) => toggleWeakPointTag(name)}",
  "onRename={renameWeakPointTag}",
  "onDelete={deleteWeakPointTag}",
  'placeholder="搜索标签"',
  ">新增标签</Button>",
  "Promise.all(weakPointDescriptions.map",
  "薄弱点",
];

const missing = requiredSnippets.filter((snippet) => !schedulePage.includes(snippet));
const forbiddenSnippets = [
  "搜索或新增",
  "const [weakPointDesc",
  "setWeakPointDesc",
  "value={lessonContent}",
  "value={lessonFeedback}",
  "<Textarea",
];
const forbidden = forbiddenSnippets.filter((snippet) => schedulePage.includes(snippet));

if (missing.length > 0) {
  console.error(`Missing lesson review weak-point link snippets: ${missing.join(", ")}`);
  process.exit(1);
}

if (forbidden.length > 0) {
  console.error(`Forbidden extra tag input snippets still present: ${forbidden.join(", ")}`);
  process.exit(1);
}

console.log("Lesson review weak-point link is present.");
