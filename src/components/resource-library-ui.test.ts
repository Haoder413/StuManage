import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("upload wizard supports filename-only AI organization and manual fallback", () => {
  const wizard = source("src/components/resource-upload-wizard.tsx");
  assert.match(wizard, /multiple/);
  assert.match(wizard, /onDrop/);
  assert.match(wizard, /\/api\/resources\/analyze-names/);
  assert.match(wizard, /只分析文件名/);
  assert.match(wizard, /needsConfirmation/);
  assert.match(wizard, /学生版/);
  assert.match(wizard, /答案版/);
  assert.match(wizard, /AI 整理暂不可用，可继续手动上传/);
});

test("teacher resource list uses paginated URL-backed search and batch actions", () => {
  const list = source("src/components/resource-group-list.tsx");
  const toolbar = source("src/components/resource-search-toolbar.tsx");
  assert.match(list, /hasNextPage/);
  assert.match(list, /selectedGroupIds/);
  assert.match(list, /group\.canManage/);
  assert.match(list, /batch-courses/);
  assert.match(list, /补传版本/);
  assert.match(list, /EditGroupDialog/);
  assert.doesNotMatch(list, /window\.prompt/);
  assert.match(toolbar, /useSearchParams/);
  assert.match(toolbar, /500/);
  assert.match(toolbar, /全部清除/);
});

test("resource center composes upload and grouped list instead of legacy single upload", () => {
  const center = source("src/components/resource-center.tsx");
  assert.match(center, /ResourceUploadWizard/);
  assert.match(center, /ResourceGroupList/);
  assert.doesNotMatch(center, /async function uploadResource/);
});
