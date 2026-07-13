import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const page = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const parentPage = readFileSync("src/app/parent/progress/page.tsx", "utf8");

assert.match(route, /data\.manageWeakPoint/, "weak-point API should support active and history editing");
assert.match(route, /reviewCount/, "weak-point API should support an exact completed review count");
assert.match(route, /export async function DELETE/, "weak-point API should support active and history deletion");
assert.match(route, /selected\.status === "active" \? "active" : { not: "active" }/, "weak-point management should keep active and history groups separate");
assert.match(route, /targetDuplicateIds/, "renaming should merge an existing same-status weak point with the target description");
assert.match(page, /openWeakPointEditor/, "teacher progress should provide a shared weak-point editor");
assert.match(page, /setDeleteWeakPointTarget/, "teacher progress should allow deleting active and history records");
assert.match(page, /flex flex-col[^\"]*sm:flex-row/, "weak-point cards should stack content and actions on narrow screens");
assert.match(page, /flex w-full flex-wrap[^\"]*sm:w-auto/, "weak-point actions should wrap on narrow screens");
assert.match(page, /修改薄弱点/, "teacher progress should provide a weak-point edit dialog");
assert.match(page, /确认删除薄弱点/, "teacher progress should confirm weak-point deletion");
assert.doesNotMatch(parentPage, /修改薄弱点|删除薄弱点/, "parent progress should remain read-only");

console.log("History weak-point management checks passed.");
