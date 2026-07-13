import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const schedulerSource = readFileSync("src/lib/review-scheduler.ts", "utf8");
const reuseSource = readFileSync("src/lib/weak-point-reuse.ts", "utf8");
const teacherPageSource = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const parentPageSource = readFileSync("src/app/parent/progress/page.tsx", "utf8");
const mobileSource = readFileSync("src/lib/mobile-parent-data.ts", "utf8");
const sharedExistingLookup = reuseSource.match(/const existing = await tx\.weakPoint\.findFirst\(\{[\s\S]*?\n  \}\);/)?.[0] || "";

assert.match(schedulerSource, /getTodayReviewDate/, "scheduler should expose a due-today helper for new weak points");

assert.match(routeSource, /data\.status === "active"/, "weak point API should support reactivating mastered weak points");
assert.match(routeSource, /masteredAt:\s*null/, "reactivating should clear mastered time");
assert.doesNotMatch(routeSource, /parseReviewDate|nextReviewAt:\s*parseReviewDate|data\.nextReviewAt|getDefaultNextReviewDate/, "review completion should not accept or create teacher-selected next review dates");
assert.doesNotMatch(routeSource, /nextStage <= 6/, "weak point API should not keep the six-stage review flow");
assert.doesNotMatch(routeSource, /stillWeak/, "weak point API should not keep the remembered-forgotten branch");
assert.match(routeSource, /ensureWeakPointReview/, "manual weak point route should use the shared lifecycle service");

assert.match(reuseSource, /masteredAt:\s*null/, "exam weak point reuse should reactivate an existing mastered weak point");
assert.ok(sharedExistingLookup, "shared weak point helper should look up an existing weak point");
assert.doesNotMatch(sharedExistingLookup, /learningLinkId/, "weak point reuse should not require the same learning link");
assert.doesNotMatch(reuseSource, /getNextReviewDate\(1\)/, "exam weak point reuse should not create staged review schedules");

for (const [label, source] of [
  ["teacher page", teacherPageSource],
  ["parent page", parentPageSource],
  ["mobile parent data", mobileSource],
]) {
  assert.doesNotMatch(source, /getStageLabel/, `${label} should not show stage labels`);
  assert.doesNotMatch(source, /巩固中/, `${label} should not show consolidating state`);
  assert.doesNotMatch(source, /statusLabel[^\n]*已完成|label[^\n]*已完成/, `${label} should not split mastered records into completed state`);
  assert.doesNotMatch(source, /下次复习|nextReviewText|nextReviewAt|复习日期/, `${label} should not show next review dates`);
}

assert.match(teacherPageSource, /已复习/, "teacher page should have a reviewed action");
assert.doesNotMatch(teacherPageSource, /reviewTarget|setReviewTarget|getDateInputDaysLater|formatDateInput/, "teacher page should record review directly without a date dialog");
assert.match(teacherPageSource, /重新激活/, "teacher page should let mastered weak points return to pending review");
assert.doesNotMatch(teacherPageSource, /记住了|忘了/, "teacher page should remove remembered-forgotten actions");

assert.match(parentPageSource, /待复习/, "parent page should keep a pending review filter");
assert.match(parentPageSource, /已掌握/, "parent page should show mastered records with one label");
assert.ok(existsSync("scripts/cleanup-duplicate-weak-points.mjs"), "duplicate weak point cleanup script should exist");

console.log("Simplified weak point review checks passed.");
