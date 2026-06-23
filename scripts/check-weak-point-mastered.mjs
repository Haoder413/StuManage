import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/weak-points/route.ts", "utf8");
const pageSource = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");

assert.match(routeSource, /statusParam === "history" \? { not: "active" } : "active"/, "weak point list should default to active items and support history");
assert.match(routeSource, /statusParam === "history"/, "weak point API should support loading historical weak points");
assert.match(routeSource, /reviewSchedules:\s*{\s*create:\s*{[\s\S]*stage:\s*1[\s\S]*nextReviewAt:\s*getNextReviewDate\(1\)[\s\S]*status:\s*"pending"/, "creating a weak point should create the first review schedule");
assert.match(routeSource, /data\.status === "mastered"[\s\S]*nextStage <= 6[\s\S]*prisma\.reviewSchedule\.create/s, "marking a weak point mastered should create the next review schedule when needed");
assert.match(pageSource, /if \(res\.ok\) await refreshWeakPoints\(\)/, "weak point mastered action should refresh only after a successful response");
assert.match(pageSource, /historyWeakPoints/, "student progress page should keep historical weak points");
assert.match(pageSource, /薄弱点复习/, "student progress page should show one unified weak point review tab");
assert.match(pageSource, /reviewFilter/, "student progress page should filter weak point review records in one place");
assert.match(pageSource, /allWeakPointTagOptions/, "student progress tag picker should combine library tags and student weak points");
assert.match(pageSource, /已有薄弱点/, "student progress tag picker should label options sourced from existing student weak points");
assert.match(pageSource, /selectWeakPointTag/, "student progress tag picker should fill the weak point description from the selected tag");
assert.doesNotMatch(pageSource, /key: "review" as const/, "student progress page should not keep a separate review tab");
assert.doesNotMatch(pageSource, /key: "history" as const/, "student progress page should not keep a separate history tab");
