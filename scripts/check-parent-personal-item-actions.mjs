import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/parent-time-management-client.tsx", "utf8");

assert.match(source, /setDeleteTarget\(item\)/, "delete action should open a confirmation dialog");
assert.match(source, /确认删除个人安排/, "delete confirmation should have a clear title");
assert.match(source, />\s*修改\s*</, "personal item should show a visible edit label");
assert.match(source, />\s*删除\s*</, "personal item should show a visible delete label");
assert.match(source, /variant="destructive"/, "delete action should use destructive styling");
assert.doesNotMatch(source, /confirm\(message\)/, "personal item deletion should not use the browser confirm prompt");

console.log("Parent personal item action checks passed.");
