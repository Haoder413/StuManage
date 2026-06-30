import { readFileSync, existsSync } from "node:fs";

function assertFileContains(file, snippets) {
  if (!existsSync(file)) {
    console.error(`Missing file: ${file}`);
    process.exitCode = 1;
    return;
  }
  const text = readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      console.error(`Missing snippet in ${file}: ${snippet}`);
      process.exitCode = 1;
    }
  }
}

assertFileContains("src/lib/mobile-parent-data.ts", [
  "getMobileParentHomework",
  "questionPreviewUrl",
  "answerDownloadUrl",
]);

assertFileContains("src/app/api/mobile/parent/homework/route.ts", [
  "GET",
  "getMobileParentHomework",
]);

assertFileContains("src/app/api/mobile/parent/homework/[submissionId]/submit/route.ts", [
  "POST",
  "findParentVisibleSubmission",
  "saveHomeworkFile",
]);

assertFileContains("src/app/api/mobile/homework/files/[kind]/[id]/route.ts", [
  "requireMobileParent",
  "getStoredHomeworkPath",
  "answerDownloadAllowed",
]);

assertFileContains("miniprogram/app.json", [
  "pages/homework/index",
]);

assertFileContains("miniprogram/pages/homework/index.json", [
  "作业",
]);

assertFileContains("miniprogram/pages/home/index.wxml", [
  "作业",
  "goHomework",
]);

assertFileContains("miniprogram/utils/api.js", [
  "upload",
  "fileUrl",
]);

assertFileContains("miniprogram/pages/homework/index.js", [
  "parent/homework",
  "chooseMessageFile",
  "upload",
  "下载答案/解析",
]);

assertFileContains("miniprogram/pages/homework/index.wxml", [
  "作业",
  "上传答案",
  "下载答案/解析",
  "提交历史",
]);

if (process.exitCode) process.exit(1);
console.log("Mini program homework structure is present.");
