import { readFileSync } from "node:fs";

const required = {
  "miniprogram/app.json": [
    "pages/calendar/index",
    "\"text\": \"日历\"",
  ],
  "src/app/api/mobile/parent/calendar/route.ts": [
    "export async function GET",
    "export async function POST",
    "export async function PATCH",
    "export async function DELETE",
    "teacher_schedule",
    "parent_item",
    "repeatDays",
  ],
  "src/app/api/mobile/parent/calendar-subjects/route.ts": [
    "export async function GET",
    "export async function POST",
    "export async function PATCH",
    "export async function DELETE",
    "parentScheduleSubject",
  ],
  "miniprogram/pages/calendar/index.js": [
    "loadCalendar",
    "saveItem",
    "deleteItem",
    "saveSubject",
    "deleteSubject",
    "toggleRepeatDay",
    "decorateRepeatDays",
    "buildCalendarDays",
  ],
  "miniprogram/pages/calendar/index.wxml": [
    "日历",
    "新增安排",
    "编辑科目",
    "manage-subject-button",
    "每周重复",
    "截止日期",
  ],
  "miniprogram/pages/calendar/index.wxss": [
    ".calendar-grid",
    ".day-cell",
    ".schedule-chip",
    ".form-card",
    ".subject-row",
    ".repeat-button-active",
    ".manage-subject-button",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(required)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

const calendarWxml = readFileSync("miniprogram/pages/calendar/index.wxml", "utf8");
if (calendarWxml.includes("学习关系")) {
  missing.push("miniprogram/pages/calendar/index.wxml: remove 学习关系 field");
}
if (calendarWxml.includes("form.learningLinkId")) {
  missing.push("miniprogram/pages/calendar/index.wxml: hide learningLinkId");
}

if (missing.length > 0) {
  console.error(`Missing mini program calendar snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program calendar support is present.");
