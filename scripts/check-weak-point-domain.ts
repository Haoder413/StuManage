import assert from "node:assert/strict";
import {
  dedupeWeakPoints,
  filterWeakPointsByStatus,
  getWeakPointStatusCounts,
  normalizeWeakPointDescriptions,
} from "../src/lib/weak-points";

assert.deepEqual(
  normalizeWeakPointDescriptions(["  分数  加减  ", "分数 加减", "", null]),
  ["分数 加减"],
);

const weakPoints = [
  {
    id: "newer",
    description: "应用题",
    status: "active",
    createdAt: new Date("2026-07-02"),
    reviewSchedules: [{ id: "new-review", createdAt: new Date("2026-07-03"), lastReviewedAt: null }],
  },
  {
    id: "older",
    description: "  应用题 ",
    status: "mastered",
    createdAt: new Date("2026-07-01"),
    reviewSchedules: [{ id: "old-review", createdAt: new Date("2026-07-01"), lastReviewedAt: null }],
  },
];

const deduped = dedupeWeakPoints(weakPoints);
assert.equal(deduped.length, 1);
assert.equal(deduped[0].id, "newer");
assert.deepEqual(deduped[0].reviewSchedules.map((schedule) => schedule.id), ["new-review", "old-review"]);

const conflictingStatuses = dedupeWeakPoints([
  { ...weakPoints[1], id: "new-mastered", createdAt: new Date("2026-07-04") },
  { ...weakPoints[0], id: "old-active", createdAt: new Date("2026-07-01") },
]);
assert.equal(conflictingStatuses[0].status, "active");

assert.deepEqual(getWeakPointStatusCounts(weakPoints), { all: 2, pending: 1, mastered: 1 });
assert.deepEqual(filterWeakPointsByStatus(weakPoints, "pending").map((point) => point.id), ["newer"]);
assert.deepEqual(filterWeakPointsByStatus(weakPoints, "mastered").map((point) => point.id), ["older"]);

console.log("Weak-point domain behavior checks passed.");
