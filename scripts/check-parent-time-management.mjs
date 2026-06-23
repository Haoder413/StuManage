import { readFileSync } from "node:fs";

const checks = {
  "prisma/schema.prisma": [
    "model ParentScheduleItem",
    "parentId     String",
    "studentId    String",
    "learningLinkId String?",
    "parentScheduleItems ParentScheduleItem[]",
    "@@index([workspaceId, parentId, date])",
  ],
  "src/app/api/parent/schedule-items/route.ts": [
    "requireParent",
    "ensureParentOwnsStudent",
    "GET",
    "POST",
    "PATCH",
    "DELETE",
    "parentScheduleItem",
    "parentId: user.id",
  ],
  "src/app/parent/lessons/page.tsx": [
    "时间管理",
    "ParentTimeManagementClient",
    "getParentLearningLinks",
  ],
  "src/components/parent-time-management-client.tsx": [
    "type CalendarItem",
    "teacher_schedule",
    "parent_item",
    "月",
    "周",
    "老师安排",
    "个人安排",
    "待上课",
  ],
  "src/components/parent-sidebar.tsx": [
    "时间管理",
    "/parent/lessons",
  ],
};

const forbidden = {
  "src/components/parent-sidebar.tsx": ["上课记录"],
  "src/app/parent/lessons/page.tsx": ["flatMap(({ student }) => student.attendance"],
  "src/app/schedule/page.tsx": ["ParentScheduleItem", "parentScheduleItem"],
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

for (const [file, snippets] of Object.entries(forbidden)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const snippet of snippets) {
    if (text.includes(snippet)) missing.push(`${file} should not include: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Parent time management check failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent time management files are present.");
