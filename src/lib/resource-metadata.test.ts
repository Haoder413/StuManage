import assert from "node:assert/strict";
import test from "node:test";
import {
  extractResourceYear,
  normalizeResourceGrade,
  resourceGradeAliases,
  resourceGradeSearchTerms,
} from "./resource-metadata";

test("expands equivalent grade names for historical resource searches", () => {
  assert.deepEqual(resourceGradeAliases("初一"), resourceGradeAliases("七年级"));
  assert.ok(resourceGradeAliases("初一").includes("7年级"));
  assert.ok(resourceGradeAliases("初二").includes("八年级"));
});

test("uses a bounded match for ambiguous primary-school aliases", () => {
  const terms = resourceGradeSearchTerms("小一");
  assert.deepEqual(terms.find((term) => term.alias === "一年级"), { alias: "一年级", mode: "startsWith" });
  assert.deepEqual(terms.find((term) => term.alias === "小学一年级"), { alias: "小学一年级", mode: "contains" });
});

test("normalizes exact grade aliases but preserves descriptive values", () => {
  assert.equal(normalizeResourceGrade("八年级"), "初二");
  assert.equal(normalizeResourceGrade("高中三年级"), "高三");
  assert.equal(normalizeResourceGrade("八年级下册"), "八年级下册");
  assert.equal(normalizeResourceGrade("  "), null);
});

test("extracts a reasonable year from titles and filenames", () => {
  assert.equal(extractResourceYear("2024沈阳市期末试卷", "答案.pdf"), 2024);
  assert.equal(extractResourceYear("期末试卷", "2023原卷.pdf"), 2023);
  assert.equal(extractResourceYear("1899年试卷", "资料.pdf"), null);
  assert.equal(extractResourceYear("试卷编号12024001.pdf"), null);
  assert.equal(extractResourceYear("没有年份", "资料.pdf"), null);
});
