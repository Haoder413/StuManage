import { readFileSync } from "node:fs";

const checks = {
  "prisma/schema.prisma": [
    "seriesId",
    "iconKey",
    "seriesEndDate",
    "repeatDays",
  ],
  "src/app/api/parent/schedule-items/route.ts": [
    "createParentScheduleItems",
    "buildRepeatDates",
    "seriesId",
    "iconKey",
    "seriesEndDate",
    "repeatDays",
    "deleteMany",
  ],
  "src/components/parent-time-management-client.tsx": [
    "SCHEDULE_ICON_OPTIONS",
    "repeatDays",
    "seriesEndDate",
    "toggleRepeatDay",
    "iconKey",
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

console.log("Parent repeat/icon schedule support is present.");
