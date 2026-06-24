import { readFileSync } from "node:fs";

const checks = {
  "prisma/schema.prisma": [
    "model ParentScheduleSubject",
    "seriesId",
    "subjectLabel",
    "seriesEndDate",
    "repeatDays",
  ],
  "src/app/api/parent/schedule-subjects/route.ts": [
    "export async function GET",
    "export async function POST",
    "export async function PATCH",
    "export async function DELETE",
    "parentScheduleSubject",
  ],
  "src/app/api/parent/schedule-items/route.ts": [
    "createParentScheduleItems",
    "buildRepeatDates",
    "seriesId",
    "subjectLabel",
    "seriesEndDate",
    "repeatDays",
    "deleteMany",
  ],
  "src/components/parent-time-management-client.tsx": [
    "subjectOptions",
    "showSubjectManager",
    "saveSubject",
    "deleteSubject",
    "编辑科目",
    "repeatDays",
    "seriesEndDate",
    "toggleRepeatDay",
    "subjectLabel",
    "max-h-[85vh]",
    "overflow-y-auto",
    "每周",
    "截止日期",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(checks)) {
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
  console.error(`Parent repeat/icon check failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent repeat subject schedule support is present.");
