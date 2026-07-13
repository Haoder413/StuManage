import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const reuseSource = readFileSync("src/lib/weak-point-reuse.ts", "utf8");
const pageSource = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");

assert.match(routeSource, /statusParam === "history" \? { not: "active" } : "active"/, "weak point list should default to active items and support history");
assert.match(routeSource, /statusParam === "history"/, "weak point API should support loading historical weak points");
assert.match(routeSource, /ensureWeakPointReview/, "manual creation should use the shared weak-point lifecycle");
assert.match(reuseSource, /reviewSchedules:\s*{\s*create:\s*{[\s\S]*stage:\s*1[\s\S]*nextReviewAt:\s*getTodayReviewDate\(\)[\s\S]*status:\s*"pending"/, "creating a weak point should create a pending review due today");
assert.match(routeSource, /data\.status === "mastered"[\s\S]*reviewSchedule\.updateMany/s, "marking a weak point mastered should close pending reviews");
assert.match(routeSource, /data\.status === "active"[\s\S]*masteredAt:\s*null/s, "mastered weak points should be reactivatable");
assert.match(pageSource, /if \(res\.ok\) await refreshWeakPoints\(\)/, "weak point mastered action should refresh only after a successful response");
assert.match(pageSource, /historyWeakPoints/, "student progress page should keep historical weak points");
assert.match(pageSource, /薄弱点复习/, "student progress page should show one unified weak point review tab");
assert.match(pageSource, /reviewFilter/, "student progress page should filter weak point review records in one place");
assert.match(pageSource, /allWeakPointTagOptions/, "student progress tag picker should combine library tags and student weak points");
assert.match(pageSource, /已有薄弱点/, "student progress tag picker should label options sourced from existing student weak points");
assert.match(pageSource, /selectWeakPointTag/, "student progress tag picker should fill the weak point description from the selected tag");
assert.match(pageSource, /已复习/, "student progress page should use the simplified reviewed action");
assert.match(pageSource, /重新激活/, "student progress page should let teachers reactivate mastered weak points");
assert.doesNotMatch(pageSource, /记住了|忘了|巩固中/, "student progress page should not keep old review states");
assert.doesNotMatch(pageSource, /key: "review" as const/, "student progress page should not keep a separate review tab");
assert.doesNotMatch(pageSource, /key: "history" as const/, "student progress page should not keep a separate history tab");
