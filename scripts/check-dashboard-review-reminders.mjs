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

console.log("Dashboard review reminder checks passed.");
