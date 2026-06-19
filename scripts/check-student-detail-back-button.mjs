import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/students/[id]/page.tsx", "utf8");

assert.match(source, /<Link href="\/students">/, "student detail page should include a back link to the student list");
assert.match(source, />.*返回.*<\/Button>/s, "student detail page should show a return button");
assert.match(source, /<div className="mb-4">[\s\S]*<Link href="\/students">/, "return button should be placed at the top-left before the header");
assert.doesNotMatch(source, /action=\{<Link href="\/students">/, "return button should not be in the page header action area");
assert.doesNotMatch(source, /未填写/, "lesson review should not show placeholder text for empty content or feedback");
assert.match(source, /const weakPointTags = parseTags\(review\.weakPointTags\)/, "lesson review should parse weak point tags from attendance");
assert.match(source, /grid-cols-3/, "lesson review should display content, feedback, and weak points side by side");
assert.doesNotMatch(source, /variant="secondary"/, "lesson review tags should use a consistent badge style");
