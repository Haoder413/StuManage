import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const attendanceRoute = readFileSync("src/app/api/attendance/route.ts", "utf8");
const scheduleItemsRoute = readFileSync("src/app/api/parent/schedule-items/route.ts", "utf8");
const parentData = readFileSync("src/lib/parent-data.ts", "utf8");

assert(
  attendanceRoute.includes("learningLinkId: learningLink?.id || null"),
  "attendance saves must persist the resolved learningLinkId"
);
assert(
  scheduleItemsRoute.includes("visibleAttendanceWhere"),
  "parent schedule items should include legacy attendance records without learningLinkId"
);
assert(
  scheduleItemsRoute.includes("dedupeAttendanceRecords"),
  "parent schedule items should dedupe legacy duplicate attendance records"
);
assert(
  parentData.includes("getParentVisibleAttendanceWhere"),
  "parent home data should use the same visible attendance filtering rules"
);
assert(
  parentData.includes("dedupeAttendanceRecords"),
  "parent home data should dedupe repeated attendance rows"
);

console.log("Parent attendance linkage checks passed.");
