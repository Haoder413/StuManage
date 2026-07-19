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
  assert.match(wizard, /mergeUploadGroup/);
  assert.doesNotMatch(wizard, /mergePrevious/);
  const editor = source("src/components/resource-group-editor.tsx");
  assert.match(editor, /合并到其他资料/);
  assert.match(editor, /mergeTargets/);
  assert.doesNotMatch(editor, /与上一组合并/);
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

test("resource filters use junior grades and validated year inputs", () => {
  const toolbar = source("src/components/resource-search-toolbar.tsx");
  assert.match(toolbar, /\["初一", "初二", "初三"\]/);
  assert.doesNotMatch(toolbar, /小一|小二|小三|小四|小五|小六|高一|高二|高三/);
  assert.doesNotMatch(toolbar, /2100 - 1900 \+ 1/);
  assert.match(toolbar, /yearInput/);
  assert.match(toolbar, /type="number"/);
  assert.match(toolbar, /min="1900"/);
  assert.match(toolbar, /max="2100"/);
  assert.match(toolbar, /请输入 1900—2100 的年份/);
  assert.match(toolbar, /year: "unset"/);
  assert.match(toolbar, /\[yearEditing, yearInput, searchParams\]/);

  const miniPage = source("miniprogram/pages/resources/index.js");
  const miniTemplate = source("miniprogram/pages/resources/index.wxml");
  assert.match(miniPage, /gradeOptions: \["全部年级", "初一", "初二", "初三"\]/);
  assert.doesNotMatch(miniPage, /yearOptions|yearIndex|2100 - 1900 \+ 1/);
  assert.match(miniPage, /applyYearFilter/);
  assert.match(miniPage, /filterUnsetYear/);
  assert.match(miniPage, /请输入 1900—2100 的年份/);
  assert.match(miniTemplate, /type="number"/);
  assert.match(miniTemplate, /bindconfirm="applyYearFilter"/);
  assert.match(miniTemplate, /bindtap="filterUnsetYear"/);
});

test("resource center composes upload and grouped list instead of legacy single upload", () => {
  const center = source("src/components/resource-center.tsx");
  assert.match(center, /ResourceUploadWizard/);
  assert.match(center, /ResourceGroupList/);
  assert.doesNotMatch(center, /async function uploadResource/);
});
