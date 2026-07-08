import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const schedulerSource = readFileSync("src/lib/review-scheduler.ts", "utf8");
const reuseSource = readFileSync("src/lib/weak-point-reuse.ts", "utf8");
const teacherPageSource = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const parentPageSource = readFileSync("src/app/parent/progress/page.tsx", "utf8");
const mobileSource = readFileSync("src/lib/mobile-parent-data.ts", "utf8");

assert.match(schedulerSource, /DEFAULT_REVIEW_INTERVAL_DAYS\s*=\s*7/, "simplified review should default the next review to 7 days later");
assert.match(schedulerSource, /getTodayReviewDate/, "scheduler should expose a due-today helper for new weak points");

assert.match(routeSource, /data\.status === "active"/, "weak point API should support reactivating mastered weak points");
assert.match(routeSource, /masteredAt:\s*null/, "reactivating should clear mastered time");
assert.match(routeSource, /parseReviewDate\(data\.nextReviewAt/, "review completion should accept a teacher-selected next review date");
assert.doesNotMatch(routeSource, /nextStage <= 6/, "weak point API should not keep the six-stage review flow");
assert.doesNotMatch(routeSource, /stillWeak/, "weak point API should not keep the remembered-forgotten branch");

assert.match(reuseSource, /masteredAt:\s*null/, "exam weak point reuse should reactivate an existing mastered weak point");
assert.doesNotMatch(reuseSource, /getNextReviewDate\(1\)/, "exam weak point reuse should not create staged review schedules");

for (const [label, source] of [
  ["teacher page", teacherPageSource],
  ["parent page", parentPageSource],
  ["mobile parent data", mobileSource],
]) {
  assert.doesNotMatch(source, /getStageLabel/, `${label} should not show stage labels`);
  assert.doesNotMatch(source, /巩固中/, `${label} should not show consolidating state`);
  assert.doesNotMatch(source, /已完成/, `${label} should not split mastered records into completed state`);
}

assert.match(teacherPageSource, /已复习/, "teacher page should have a reviewed action");
assert.match(teacherPageSource, /下次复习日期/, "teacher page should let the teacher choose the next review date");
assert.match(teacherPageSource, /重新激活/, "teacher page should let mastered weak points return to pending review");
assert.doesNotMatch(teacherPageSource, /记住了|忘了/, "teacher page should remove remembered-forgotten actions");

assert.match(parentPageSource, /待复习/, "parent page should keep a pending review filter");
assert.match(parentPageSource, /已掌握/, "parent page should show mastered records with one label");

console.log("Simplified weak point review checks passed.");
