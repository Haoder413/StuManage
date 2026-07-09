import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(source, pattern, message) {
  if (!source.includes(pattern)) {
    console.error(message);
    process.exit(1);
  }
}

function assertNotIncludes(source, pattern, message) {
  if (source.includes(pattern)) {
    console.error(message);
    process.exit(1);
  }
}

const timeClient = read("src/components/parent-time-management-client.tsx");
const scheduleRoute = read("src/app/api/parent/schedule-items/route.ts");
const examsPage = read("src/app/parent/exams/page.tsx");
const progressPage = read("src/app/parent/progress/page.tsx");

assertNotIncludes(
  timeClient,
  '<Label className="text-xs text-gray-500">学习关系</Label>',
  "personal schedule dialog should not show learning link field"
);
assertIncludes(timeClient, "studentId:", "personal schedule save should submit a student id");
assertIncludes(scheduleRoute, "learningLinkId: null", "parent personal schedule items should save without learning link binding");
assertIncludes(examsPage, "selectedLinkId", "parent exams page should track selected learning link");
assertIncludes(examsPage, "exam.learningLinkId === selectedLinkId", "parent exams should filter records by selected learning link");
assertIncludes(progressPage, "getParentLearningData", "parent progress should use selected learning-link data");
assertIncludes(progressPage, "selectedLinkId", "parent progress should expose selected learning-link state");

console.log("parent link isolation checks passed");
