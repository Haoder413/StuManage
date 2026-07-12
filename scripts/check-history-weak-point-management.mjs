import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const page = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const parentPage = readFileSync("src/app/parent/progress/page.tsx", "utf8");

assert.match(route, /data\.manageHistory/, "weak-point API should support history editing");
assert.match(route, /reviewCount/, "weak-point API should support an exact completed review count");
assert.match(route, /export async function DELETE/, "weak-point API should support history deletion");
assert.match(route, /status:\s*{\s*not:\s*"active"\s*}/, "history management should reject active weak points");
assert.match(page, /修改历史薄弱点/, "teacher progress should provide a history edit dialog");
assert.match(page, /确认删除历史薄弱点/, "teacher progress should confirm history deletion");
assert.doesNotMatch(parentPage, /修改历史薄弱点|删除历史薄弱点/, "parent progress should remain read-only");

console.log("History weak-point management checks passed.");
