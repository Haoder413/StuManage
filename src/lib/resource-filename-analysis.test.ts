import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeResourceFileNames,
  validateAnalysisResult,
} from "./resource-filename-analysis";

test("pairs matching student and answer variants at high confidence", () => {
  const result = analyzeResourceFileNames([
    "2024初二数学一次函数训练无答案.pdf",
    "2024初二数学一次函数训练答案.pdf",
  ]);

  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].files.map((file) => file.role), ["student", "answer"]);
  assert.equal(result.groups[0].needsConfirmation, false);
  assert.equal(result.groups[0].title, "2024初二数学一次函数训练");
});

test("keeps uncertain names separate and asks for confirmation", () => {
  const result = analyzeResourceFileNames(["练习1.pdf", "参考资料.pdf"]);

  assert.equal(result.groups.length, 2);
  assert.ok(result.groups.every((group) => group.needsConfirmation));
});

test("extracts grade, subject, kind and useful tags from a filename", () => {
  const [group] = analyzeResourceFileNames(["初三数学二次函数期中试卷.pdf"]).groups;

  assert.equal(group.grade, "初三");
  assert.equal(group.subject, "数学");
  assert.equal(group.resourceKind, "paper");
  assert.ok(group.tags.includes("二次函数"));
  assert.ok(group.tags.includes("期中"));
});

test("rejects malformed AI results instead of trusting them", () => {
  assert.equal(validateAnalysisResult({ groups: [{ title: "x" }] }, ["x.pdf"]), null);
  assert.equal(validateAnalysisResult({ groups: [] }, ["x.pdf"]), null);
  assert.equal(validateAnalysisResult({ groups: [{
    groupKey: "x",
    title: "x".repeat(201),
    grade: null,
    subject: null,
    resourceKind: "paper",
    tags: [],
    confidence: 1,
    needsConfirmation: false,
    reason: "ok",
    files: [{ originalName: "x.pdf", role: "student" }],
  }] }, ["x.pdf"]), null);
});
