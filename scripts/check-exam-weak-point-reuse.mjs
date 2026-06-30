import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("src/lib/weak-point-reuse.ts", "utf8");
const examsRoute = readFileSync("src/app/api/exams/route.ts", "utf8");
const reviewRoute = readFileSync("src/app/api/exams/review/route.ts", "utf8");

assert.match(helper, /export async function applyExamWeakPoints/, "shared helper should apply exam weak points");
assert.match(helper, /status: "active"/, "helper should reuse active weak points");
assert.match(helper, /reviewSchedules:\s*\{\s*some:\s*\{\s*status: "pending"/s, "helper should treat pending review schedules as consolidating records");
assert.match(helper, /findFirst/, "helper should look for an existing unfinished weak point before creating");
assert.match(helper, /if \(pendingSchedule\) continue;/, "helper should not duplicate pending review schedules");
assert.match(helper, /tx\.weakPoint\.create/, "helper should create a new weak point when no unfinished one exists");
assert.match(helper, /getNextReviewDate\(1\)/, "new weak points should start from the first review stage");
assert.doesNotMatch(helper, /status: "mastered"[\s\S]*data: \{ status: "active"/, "completed mastered weak points should not be reactivated");

assert.match(examsRoute, /applyExamWeakPoints/, "teacher exam save should use shared weak point reuse logic");
assert.doesNotMatch(examsRoute, /weakPoint\.createMany/, "teacher exam save should not bulk-create duplicate weak points");
assert.match(reviewRoute, /applyExamWeakPoints/, "exam review approval should use shared weak point reuse logic");
assert.doesNotMatch(reviewRoute, /tx\.weakPoint\.create\(\{[\s\S]*description/s, "exam review route should not directly create weak points");

console.log("Exam weak point reuse logic is present.");
