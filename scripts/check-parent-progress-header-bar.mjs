import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const section = readFileSync("src/app/parent/progress/parent-progress-section.tsx", "utf8");
const page = readFileSync("src/app/parent/progress/page.tsx", "utf8");

assert.match(section, /summary\?: ReactNode/, "progress section should support inline header content");
assert.match(section, /flex-1[\s\S]*\{summary\}/, "inline summary should fill the title row");
assert.match(page, /title="知识点进度"[\s\S]*summary=\{/, "knowledge progress should provide an inline summary");
assert.doesNotMatch(page, /<ParentProgressSection title="知识点进度"[^>]*>[\s\S]{0,160}mb-4 flex items-center gap-3/, "progress bar should not remain in the card body");

console.log("Parent knowledge progress bar is displayed in the section header.");
