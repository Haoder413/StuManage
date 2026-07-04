import { readFileSync } from "node:fs";

function assertIncludes(file, snippet, label) {
  if (!file.includes(snippet)) {
    throw new Error(`${label}: missing ${snippet}`);
  }
}

const attendanceRoute = readFileSync("src/app/api/attendance/route.ts", "utf8");
const cleanupScript = readFileSync("scripts/cleanup-duplicate-attendance.mjs", "utf8");

assertIncludes(
  attendanceRoute,
  "findReusableAttendance",
  "attendance save should reuse legacy attendance rows before creating new ones"
);
assertIncludes(
  attendanceRoute,
  "learningLinkId: null",
  "attendance save should consider legacy rows without learningLinkId"
);
assertIncludes(
  cleanupScript,
  "--apply",
  "cleanup script should require an explicit apply flag before deleting data"
);
assertIncludes(
  cleanupScript,
  "lessonVideo.update",
  "cleanup script should preserve lesson videos when deleting duplicate attendance"
);
assertIncludes(
  cleanupScript,
  "lessonHourLog.updateMany",
  "cleanup script should preserve lesson hour history when deleting duplicate attendance"
);
assertIncludes(
  cleanupScript,
  "attendance.deleteMany",
  "cleanup script should delete duplicate attendance only after reassignment"
);

console.log("attendance dedupe cleanup checks passed");
