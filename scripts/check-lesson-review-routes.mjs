import { existsSync, readFileSync } from "node:fs";

const attendanceRoute = readFileSync("src/app/api/attendance/route.ts", "utf8");
const lessonTagsPath = "src/app/api/lesson-tags/route.ts";
const lessonTagsRoute = existsSync(lessonTagsPath) ? readFileSync(lessonTagsPath, "utf8") : "";

const requiredAttendanceSnippets = [
  "lessonContent",
  "lessonFeedback",
  "contentTags",
  "feedbackTags",
];

const requiredTagSnippets = [
  "lessonTag.findMany",
  "lessonTag.create",
  "lessonTag.update",
  "lessonTag.delete",
];

const missing = [
  ...requiredAttendanceSnippets.filter((snippet) => !attendanceRoute.includes(snippet)),
  ...requiredTagSnippets.filter((snippet) => !lessonTagsRoute.includes(snippet)),
];

if (missing.length > 0) {
  console.error(`Missing lesson review route snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Lesson review route shape is present.");
