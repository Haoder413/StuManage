import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");

assert.match(page, /try\s*{[\s\S]*finally\s*{[\s\S]*setLoading\(false\)/, "teacher progress detail loading should always finish");
assert.match(page, /Array\.isArray\(allProgress\)/, "teacher progress detail should guard malformed progress responses");
assert.match(page, /Array\.isArray\(allStudents\)/, "teacher progress detail should guard malformed student responses");
assert.doesNotMatch(page, /fetch\(`\/api\/courses\?id=\$\{c\.id\}`\)/, "teacher progress detail should not block loading on unused per-course fetches");

console.log("Teacher progress detail loading checks passed.");
