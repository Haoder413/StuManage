import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileData = readFileSync("src/lib/mobile-parent-data.ts", "utf8");
const homeJs = readFileSync("miniprogram/pages/home/index.js", "utf8");
const calendarWxss = readFileSync("miniprogram/pages/calendar/index.wxss", "utf8");

assert.match(mobileData, /const seenCourseNames = new Set<string>\(\)/, "mobile home should dedupe visible course names");
assert.match(mobileData, /\.filter\(\(item\) => item\.status === "active"\)/, "mobile home should only expose active student courses");
assert.match(mobileData, /normalizeCourseName\(item\.course\.name\)/, "mobile home should normalize course names before deduping");
assert.match(mobileData, /if \(seenCourseNames\.has\(courseName\)\) return items;/, "duplicate course names should be skipped");
assert.match(homeJs, /function dedupeCourses\(courses\)/, "mini program home should dedupe courses defensively");
assert.match(homeJs, /courses:\s*dedupeCourses\(student\.courses\)/, "mini program home should render deduped courses");

assert.match(calendarWxss, /\.action-row\s*{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*flex-end;[\s\S]*gap:\s*16rpx;/, "calendar action buttons should be laid out as a compact row");
assert.match(calendarWxss, /\.action-row \.text-button,[\s\S]*\.action-row \.danger-button\s*{[\s\S]*min-width:\s*112rpx;[\s\S]*border-radius:\s*999rpx;/, "calendar action buttons should use pill styling");
assert.match(calendarWxss, /\.action-row \.danger-button\s*{[\s\S]*background:\s*#fef2f2;/, "calendar delete button should have a soft danger style");

console.log("Mini program home polish checks passed.");
