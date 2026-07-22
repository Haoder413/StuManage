import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConsistentTeacherProgressStatuses,
  dedupeTeacherProgress,
  resolveTeacherProgressCourse,
  sortTeacherProgressCourses,
  summarizeTeacherProgress,
} from "./teacher-progress";

const courses = [
  {
    id: "math-recent-progress",
    name: "同步数学",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastProgressAt: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "math-recent-update",
    name: "暑期数学",
    updatedAt: "2026-07-21T00:00:00.000Z",
    lastProgressAt: null,
  },
];

test("a valid stored course wins over recent progress", () => {
  assert.equal(resolveTeacherProgressCourse(courses, "math-recent-update"), "math-recent-update");
});

test("an invalid stored course falls back to recent progress then course update time", () => {
  assert.equal(resolveTeacherProgressCourse(courses, "physics"), "math-recent-progress");
  assert.equal(
    resolveTeacherProgressCourse(courses.map((course) => ({ ...course, lastProgressAt: null })), null),
    "math-recent-update",
  );
  assert.equal(resolveTeacherProgressCourse([], "math-recent-update"), null);
});

test("course sorting uses progress time, update time, then a stable Chinese name", () => {
  const sorted = sortTeacherProgressCourses([
    { id: "b", name: "乙课程", updatedAt: "2026-01-01", lastProgressAt: null },
    { id: "a", name: "甲课程", updatedAt: "2026-01-01", lastProgressAt: null },
    ...courses,
  ]);
  assert.deepEqual(sorted.map((course) => course.id), ["math-recent-progress", "math-recent-update", "a", "b"]);
});

test("progress deduplication prefers the current linked record, then the most recent record", () => {
  const rows = dedupeTeacherProgress([
    { knowledgePointId: "a", status: "mastered", learningLinkId: null, updatedAt: new Date("2026-07-20") },
    { knowledgePointId: "a", status: "learning", learningLinkId: "math-link", updatedAt: new Date("2026-07-18") },
    { knowledgePointId: "b", status: "mastered", learningLinkId: "math-link", updatedAt: new Date("2026-07-18") },
    { knowledgePointId: "b", status: "learning", learningLinkId: "math-link", updatedAt: new Date("2026-07-19") },
  ]);
  assert.deepEqual(rows.map((row) => [row.knowledgePointId, row.status]), [
    ["a", "learning"],
    ["b", "learning"],
  ]);
});

test("summary counts only real learning and leaves missing points not started", () => {
  assert.deepEqual(summarizeTeacherProgress(5, [
    { knowledgePointId: "a", status: "learning", updatedAt: new Date("2026-01-01") },
    { knowledgePointId: "b", status: "mastered", updatedAt: new Date("2026-01-02") },
    { knowledgePointId: "c", status: "not_started", updatedAt: new Date(0) },
  ]), {
    total: 5,
    mastered: 1,
    learning: 1,
    notStarted: 3,
    progressPct: 20,
  });
});

test("tree consistency preserves fully untouched branches as not started", () => {
  assert.deepEqual(calculateConsistentTeacherProgressStatuses([
    { id: "root", parentId: null },
    { id: "a", parentId: "root" },
    { id: "b", parentId: "root" },
  ], { root: "learning", a: "not_started", b: "not_started" }), {
    a: "not_started",
    b: "not_started",
    root: "not_started",
  });
  assert.equal(calculateConsistentTeacherProgressStatuses([
    { id: "root", parentId: null },
    { id: "a", parentId: "root" },
    { id: "b", parentId: "root" },
  ], { a: "mastered", b: "learning" }).root, "learning");
});
