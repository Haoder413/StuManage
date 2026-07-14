import assert from "node:assert/strict";
import test from "node:test";
import { parseBatchCourseChange, parseResourceGroupUpdate } from "./resource-group-input";

test("normalizes editable group metadata", () => {
  assert.deepEqual(parseResourceGroupUpdate({
    title: "  初二函数试卷  ",
    description: " ",
    grade: "初二",
    year: 2024,
    subject: "数学",
    resourceKind: "paper",
    tags: [" 函数 ", "函数"],
    confirmInformation: true,
  }), {
    title: "初二函数试卷",
    description: null,
    grade: "初二",
    year: 2024,
    subject: "数学",
    resourceKind: "paper",
    tags: ["函数"],
    confirmInformation: true,
  });
});

test("allows clearing a year and rejects unreasonable years", () => {
  const base = { title: "资料", description: "", grade: "", year: "", subject: "", resourceKind: "material", tags: [] };
  assert.equal(parseResourceGroupUpdate(base).year, null);
  assert.throws(() => parseResourceGroupUpdate({ ...base, year: 1800 }), /invalid_resource_year/);
});

test("metadata review is cleared only by explicit confirmation", () => {
  const base = { title: "资料", description: "", grade: "", subject: "", resourceKind: "material", tags: [] };
  assert.equal(parseResourceGroupUpdate(base).confirmInformation, false);
  assert.equal(parseResourceGroupUpdate({ ...base, confirmInformation: true }).confirmInformation, true);
  assert.equal(parseResourceGroupUpdate({ ...base, confirmInformation: "true" }).confirmInformation, false);
});

test("batch course changes deduplicate ids and reject overlap", () => {
  assert.deepEqual(parseBatchCourseChange({
    groupIds: ["g1", "g1"],
    addCourseIds: ["c1", "c1"],
    removeCourseIds: ["c2"],
  }), { groupIds: ["g1"], addCourseIds: ["c1"], removeCourseIds: ["c2"] });
  assert.throws(() => parseBatchCourseChange({
    groupIds: ["g1"], addCourseIds: ["c1"], removeCourseIds: ["c1"],
  }), /course_change_overlap/);
});
