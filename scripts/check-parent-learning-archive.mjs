import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sidebar = readFileSync("src/components/parent-sidebar.tsx", "utf8");
const archivePage = readFileSync("src/app/parent/archive/page.tsx", "utf8");

assert(sidebar.includes("/parent/archive"), "parent sidebar should include the learning archive route");
assert(sidebar.includes("学习档案"), "parent sidebar should label the new entry as 学习档案");
assert(archivePage.includes("requireParent"), "learning archive page should require parent login");
assert(archivePage.includes("getParentStudents"), "learning archive page should use parent-visible student data");
assert(archivePage.includes("dedupeArchiveLessons"), "learning archive should dedupe legacy duplicate attendance cards");
assert(archivePage.includes("archiveLessonKey"), "learning archive should compare lesson identity by visible lesson fields");
assert(archivePage.includes("课堂回放"), "learning archive should show lesson video playback");
assert(archivePage.includes("上课内容"), "learning archive should show lesson content");
assert(archivePage.includes("上课反馈"), "learning archive should show lesson feedback");
assert(archivePage.includes("内容标签"), "learning archive should show content tags");
assert(archivePage.includes("反馈标签"), "learning archive should show feedback tags");
assert(archivePage.includes("薄弱点"), "learning archive should show weak point tags");

console.log("Parent learning archive checks passed.");
