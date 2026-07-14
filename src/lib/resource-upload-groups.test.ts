import assert from "node:assert/strict";
import test from "node:test";
import type { EditableUploadGroup } from "@/components/resource-group-editor";

function group(groupKey: string, title: string, file: string): EditableUploadGroup {
  return {
    groupKey,
    title,
    grade: null,
    subject: "数学",
    resourceKind: "paper",
    tags: [groupKey],
    confidence: 0.5,
    needsConfirmation: true,
    reason: "待确认",
    courseIds: [`course-${groupKey}`],
    files: [{ originalName: file, role: "supplement" }],
  };
}

test("merges a source into any target while preserving target position and metadata", async () => {
  let mergeUploadGroup: undefined | ((groups: EditableUploadGroup[], sourceKey: string, targetKey: string) => EditableUploadGroup[]);
  try {
    ({ mergeUploadGroup } = await import("./resource-upload-groups"));
  } catch {
    // The assertion below is the expected RED state before the helper exists.
  }
  assert.equal(typeof mergeUploadGroup, "function");

  const groups = [
    group("answer", "答案标题", "答案.pdf"),
    group("other", "其他资料", "其他.pdf"),
    group("paper", "保留的试卷标题", "试卷.pdf"),
  ];
  const result = mergeUploadGroup!(groups, "answer", "paper");

  assert.deepEqual(result.map((item) => item.groupKey), ["other", "paper"]);
  assert.equal(result[1].title, "保留的试卷标题");
  assert.deepEqual(result[1].files.map((file) => file.originalName), ["试卷.pdf", "答案.pdf"]);
  assert.deepEqual(result[1].tags, ["paper", "answer"]);
  assert.deepEqual(result[1].courseIds, ["course-paper", "course-answer"]);
  assert.equal(result[1].reason, "已手动合并，请确认版本类型");
});

test("supports merging a later source into an earlier target", async () => {
  const { mergeUploadGroup } = await import("./resource-upload-groups");
  const result = mergeUploadGroup([
    group("paper", "目标", "试卷.pdf"),
    group("middle", "中间", "中间.pdf"),
    group("answer", "来源", "答案.pdf"),
  ], "answer", "paper");

  assert.deepEqual(result.map((item) => item.groupKey), ["paper", "middle"]);
  assert.deepEqual(result[0].files.map((file) => file.originalName), ["试卷.pdf", "答案.pdf"]);
});

test("creates a unique key after repeated splits", async () => {
  const helpers = await import("./resource-upload-groups") as Record<string, unknown>;
  assert.equal(typeof helpers.createUniqueUploadGroupKey, "function");
  const createUniqueUploadGroupKey = helpers.createUniqueUploadGroupKey as (groups: EditableUploadGroup[], preferred: string) => string;
  const groups = [
    group("paper", "原组", "试卷.pdf"),
    group("paper-split-0", "第一次拆分", "答案.pdf"),
  ];
  assert.equal(createUniqueUploadGroupKey(groups, "paper-split-0"), "paper-split-0-2");
});
