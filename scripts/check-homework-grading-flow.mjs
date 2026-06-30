import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function assertFileContains(file, snippets) {
  assert(exists(file), `${file} should exist`);
  if (!exists(file)) return;
  const content = read(file);
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${file} should contain ${snippet}`);
  }
}

assertFileContains("prisma/schema.prisma", [
  "model HomeworkAssignment",
  "model HomeworkQuestion",
  "model HomeworkSubmission",
  "model HomeworkSubmissionVersion",
  "model HomeworkQuestionReview",
  "homeworkAssignments",
  "homeworkSubmissions",
  "answerPreviewStoredName",
  "questionPreviewStoredName",
]);

assertFileContains("src/lib/homework-storage.ts", [
  "HOMEWORK_UPLOAD_DIR",
  "saveHomeworkFile",
  "convertStoredHomeworkFileToPdf",
  "--convert-to",
  "UserInstallation",
  "isAllowedTeacherHomeworkExtension",
  "isAllowedParentHomeworkExtension",
]);

assertFileContains("src/lib/homework-recognition.ts", [
  "extractHomeworkTextFromFile",
  "extractHomeworkTextFromBuffer",
  "recognizeHomeworkStructure",
  "local_rules",
  "HomeworkRecognizedQuestion",
]);

assertFileContains("src/lib/homework-access.ts", [
  "canManageHomework",
  "findParentVisibleSubmission",
  "getHomeworkStatusLabel",
]);

const requiredRoutes = [
  "src/app/api/homework/route.ts",
  "src/app/api/homework/[id]/route.ts",
  "src/app/api/homework/[id]/submissions/[submissionId]/grade/route.ts",
  "src/app/api/homework/files/[kind]/[id]/route.ts",
  "src/app/api/parent/homework/route.ts",
  "src/app/api/parent/homework/[submissionId]/submit/route.ts",
];

for (const route of requiredRoutes) {
  assert(exists(route), `${route} should exist`);
}

const requiredPages = [
  "src/app/homework/page.tsx",
  "src/app/homework/new/page.tsx",
  "src/app/homework/[id]/page.tsx",
  "src/app/homework/[id]/review-structure/page.tsx",
  "src/app/homework/[id]/submissions/[submissionId]/page.tsx",
  "src/app/parent/homework/page.tsx",
  "src/app/parent/homework/[submissionId]/page.tsx",
];

for (const page of requiredPages) {
  assert(exists(page), `${page} should exist`);
}

assertFileContains("src/components/sidebar.tsx", [
  'href: "/homework"',
  'label: "作业批改"',
]);

assertFileContains("src/components/parent-sidebar.tsx", [
  'href: "/parent/homework"',
  'label: "作业"',
]);

assertFileContains("src/app/homework/[id]/submissions/[submissionId]/page.tsx", [
  "<iframe",
  "学生答案预览",
  "标准答案预览",
  "下载答案",
  "flex-col",
  "xl:grid-cols-[38%_32%_30%]",
  "overflow-y-auto",
  "独立滚动",
]);

assertFileContains("src/app/parent/homework/[submissionId]/page.tsx", [
  "下载答案/解析",
  "mode=download",
]);

assertFileContains("src/app/homework/[id]/page.tsx", [
  "HomeworkDeleteButton",
]);

assertFileContains("src/components/homework-delete-button.tsx", [
  "删除作业",
  "DELETE",
  "确定删除这份作业吗",
]);

assertFileContains("src/app/api/homework/[id]/route.ts", [
  "export async function DELETE",
  "homeworkAssignment.delete",
]);

assertFileContains("src/app/api/homework/files/[kind]/[id]/route.ts", [
  "extractHomeworkTextFromBuffer",
  "convertStoredHomeworkFileToPdf",
  "application/pdf",
  "text/html; charset=utf-8",
  "renderHomeworkDocxPreview",
  "answerDownloadAllowed",
]);

assertFileContains("src/app/homework/[id]/review-structure/page.tsx", [
  "填空题有几题",
  "选择题有几题",
  "大题有几题",
  "计算题有几题",
  "生成题目结构",
]);

const structurePage = read("src/app/homework/[id]/review-structure/page.tsx");
assert(!structurePage.includes("重新识别"), "review structure page should not expose recognition");
const homeworkRoute = read("src/app/api/homework/route.ts");
assert(!homeworkRoute.includes("recognizeHomeworkStructure"), "homework creation should not auto-recognize files");
const homeworkDetailRoute = read("src/app/api/homework/[id]/route.ts");
assert(!homeworkDetailRoute.includes('body.action === "recognize"'), "homework detail route should not expose recognize action");

assertFileContains("docs/操作手册.md", [
  "### 3.8 作业批改",
  "### 4.6 作业",
  "已批改后家长仍可重新上传",
]);

if (!process.exitCode) {
  console.log("Homework grading structure check passed.");
}
