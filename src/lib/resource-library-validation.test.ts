import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeResourceTags,
  parseResourceGroupQuery,
  parseResourceGroupManifest,
  validateUploadBatch,
} from "./resource-library-validation";

function fakeFile(name: string, size: number) {
  return { name, size };
}

test("enforces upload file count and size limits", () => {
  assert.throws(
    () => validateUploadBatch(Array.from({ length: 51 }, (_, index) => fakeFile(`${index}.pdf`, 1))),
    /too_many_files/
  );
  assert.throws(
    () => validateUploadBatch([fakeFile("large.pdf", 101 * 1024 * 1024)]),
    /file_too_large/
  );
});

test("normalizes and deduplicates tags", () => {
  assert.deepEqual(normalizeResourceTags([" 函数 ", "函数", "期中", "", " 期中 "]), ["函数", "期中"]);
});

test("requires every uploaded file index exactly once in the manifest", () => {
  const valid = JSON.stringify({ groups: [{
    title: "初二数学试卷",
    grade: "初二",
    subject: "数学",
    resourceKind: "paper",
    tags: ["函数"],
    courseIds: ["course-1"],
    files: [{ fileIndex: 0, role: "student" }, { fileIndex: 1, role: "answer" }],
  }] });
  assert.equal(parseResourceGroupManifest(valid, 2).groups.length, 1);

  assert.throws(() => parseResourceGroupManifest(valid, 3), /manifest_file_mismatch/);
  assert.throws(() => parseResourceGroupManifest(valid, 1), /manifest_file_mismatch/);
});

test("rejects two answer files in the same group", () => {
  const invalid = JSON.stringify({ groups: [{
    title: "初二数学试卷",
    resourceKind: "paper",
    tags: [],
    courseIds: [],
    files: [{ fileIndex: 0, role: "answer" }, { fileIndex: 1, role: "answer" }],
  }] });
  assert.throws(() => parseResourceGroupManifest(invalid, 2), /duplicate_primary_role/);
});

test("normalizes pagination and supported search filters", () => {
  const query = parseResourceGroupQuery(new URLSearchParams({
    q: "  函数  ",
    page: "3",
    pageSize: "500",
    sort: "title",
    fileState: "complete",
  }));

  assert.deepEqual(query, {
    q: "函数",
    grade: "",
    subject: "",
    resourceKind: "",
    fileState: "complete",
    courseId: "",
    workspaceId: "",
    sort: "title",
    page: 3,
    pageSize: 100,
  });
});
