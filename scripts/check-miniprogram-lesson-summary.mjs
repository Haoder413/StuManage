import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileData = readFileSync("src/lib/mobile-parent-data.ts", "utf8");
const homeJs = readFileSync("miniprogram/pages/home/index.js", "utf8");
const homeWxml = readFileSync("miniprogram/pages/home/index.wxml", "utf8");
const calendarRoute = readFileSync("src/app/api/mobile/parent/calendar/route.ts", "utf8");
const calendarWxml = readFileSync("miniprogram/pages/calendar/index.wxml", "utf8");
const calendarWxss = readFileSync("miniprogram/pages/calendar/index.wxss", "utf8");

assert.match(mobileData, /status === "present"\) return "正常上课"/, "present attendance should be labeled 正常上课");
assert.match(mobileData, /weakPointTags:\s*parseTags\(item\.weakPointTags\)/, "mobile home lessons should expose weak point tags");
assert.match(homeJs, /weakPointText:\s*\(lesson\.weakPointTags \|\| \[\]\)\.join\("、"\)/, "home page should format weak point tags");
assert.match(homeWxml, /薄弱点：\{\{lesson\.weakPointText \|\| '待老师填写'\}\}/, "home page should show weak points");

assert.match(calendarRoute, /const weakPointTags = parseTags\(record\.weakPointTags\);/, "calendar teacher attendance should parse weak point tags");
assert.match(calendarRoute, /weakPointTags,\s*[\r\n]\s*weakPointText:\s*weakPointTags\.join\("、"\)/, "calendar teacher attendance should expose weak point text");
assert.match(calendarWxml, /薄弱点：\{\{item\.attendance\[0\]\.weakPointText \|\| '待老师填写'\}\}/, "calendar details should show weak points");

assert.match(calendarWxss, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/, "calendar columns should be equal and shrinkable");
assert.match(calendarWxss, /\.day-cell\s*{[\s\S]*min-width:\s*0;[\s\S]*overflow:\s*hidden;/, "calendar day cells should not be widened by content");
assert.match(calendarWxss, /\.schedule-chip\s*{[\s\S]*max-width:\s*100%;[\s\S]*box-sizing:\s*border-box;/, "calendar chips should stay inside their cell");

console.log("Mini program lesson summary and calendar layout checks passed.");
