import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const teacherSidebar = readFileSync("src/components/sidebar.tsx", "utf8");
const parentSidebar = readFileSync("src/components/parent-sidebar.tsx", "utf8");
const courseDetail = readFileSync("src/app/courses/[id]/page.tsx", "utf8");
const miniProgramHome = readFileSync("miniprogram/pages/home/index.wxml", "utf8");
const miniProgramHomeLogic = readFileSync("miniprogram/pages/home/index.js", "utf8");

assert.doesNotMatch(teacherSidebar, /href:\s*["']\/homework["']/, "teacher sidebar should hide homework");
assert.doesNotMatch(parentSidebar, /href:\s*["']\/parent\/homework["']/, "parent sidebar should hide homework");
assert.doesNotMatch(courseDetail, /课程作业|\/homework\//, "course detail should hide homework shortcuts");
assert.doesNotMatch(miniProgramHome, /goHomework|>作业</, "mini program home should hide homework card");
assert.doesNotMatch(miniProgramHomeLogic, /goHomework|pages\/homework/, "mini program home should hide homework navigation");

assert.ok(existsSync("src/app/homework/page.tsx"), "teacher homework pages should remain available for the rebuild");
assert.ok(existsSync("src/app/parent/homework/page.tsx"), "parent homework pages should remain available for the rebuild");
assert.ok(existsSync("miniprogram/pages/homework/index.js"), "mini program homework page should remain available for the rebuild");

console.log("Homework entry points are hidden while the existing implementation remains intact.");
