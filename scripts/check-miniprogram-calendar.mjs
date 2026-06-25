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
    "buildCalendarDays",
  ],
  "miniprogram/pages/calendar/index.wxml": [
    "日历",
    "新增安排",
    "编辑科目",
    "每周重复",
    "截止日期",
  ],
  "miniprogram/pages/calendar/index.wxss": [
    ".calendar-grid",
    ".day-cell",
    ".schedule-chip",
    ".form-card",
    ".subject-row",
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

if (missing.length > 0) {
  console.error(`Missing mini program calendar snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program calendar support is present.");
