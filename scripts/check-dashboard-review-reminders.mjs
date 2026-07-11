import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/app/dashboard/page.tsx", "utf8");

assert.match(
  dashboardSource,
  /dedupePendingReviews\(pendingReviewRows\)/,
  "dashboard should deduplicate pending review rows before counting and rendering",
);
assert.match(
  dashboardSource,
  /const pendingReviews = dedupePendingReviews\(pendingReviewRows\)/,
  "dashboard reminder count and list should share the deduplicated result",
);
assert.doesNotMatch(
  dashboardSource,
  /第\{r\.stage\}次/,
  "dashboard should not show obsolete expected review stages",
);
assert.doesNotMatch(
  dashboardSource,
  /isOverdue/,
  "dashboard should not classify simplified pending reviews as overdue",
);
assert.match(
  dashboardSource,
  />待复习</,
  "dashboard should label pending reviews consistently",
);
assert.match(
  dashboardSource,
  /AND:\s*\[\s*visibleScheduleWhere\(user\)/,
  "dashboard should preserve teacher visibility when adding today's schedule filters",
);
assert.match(
  dashboardSource,
  /isActive:\s*true/,
  "dashboard should exclude inactive schedule times left by course edits",
);
assert.match(
  dashboardSource,
  /startDate:\s*null[\s\S]*startDate:\s*\{\s*lte:\s*today\s*\}[\s\S]*endDate:\s*null[\s\S]*endDate:\s*\{\s*gte:\s*today\s*\}/,
  "dashboard should respect fixed schedule start and end dates",
);

console.log("Dashboard review reminder checks passed.");
