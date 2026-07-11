import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const scriptPath = "scripts/backfill-course-ownership.mjs";
assert.equal(existsSync(scriptPath), true, "course ownership backfill script should exist");

const source = readFileSync(scriptPath, "utf8");
assert.match(source, /process\.argv\.includes\("--apply"\)/, "script should default to dry-run and require --apply");
assert.match(source, /createdById:\s*null/, "script should only inspect courses without an owner");
assert.match(source, /studentCourses/, "script should infer owners from enrolled students");
assert.match(source, /learningLinks/, "script should infer owners from active learning links");
assert.match(source, /workspaceTeacherIds/, "script should support a single-teacher workspace fallback");
assert.match(source, /candidateTeacherIds\.size !== 1/, "script should skip ambiguous or unknown ownership");
assert.match(source, /prisma\.course\.update/, "apply mode should update the inferred course owner");

console.log("Course ownership backfill checks passed.");
