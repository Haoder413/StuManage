import fs from "node:fs";

const route = fs.readFileSync("src/app/api/attendance/route.ts", "utf8");
const schedulePage = fs.readFileSync("src/app/schedule/page.tsx", "utf8");

if (!route.includes('isPresentAttendance = data.status === "present"')) {
  throw new Error("attendance API should only consume lesson hours for present attendance");
}

if (!route.includes("existing?.status === \"present\"")) {
  throw new Error("attendance API should avoid double-consuming a lesson hour on repeated present saves");
}

if (!route.includes("remainingLessonHours: { gt: 0 }")) {
  throw new Error("attendance API should not decrement remaining lesson hours below zero");
}

if (!route.includes("shouldRestoreLessonHour")) {
  throw new Error("attendance API should restore a consumed lesson hour if present is changed to non-present");
}

if (!schedulePage.includes("handleAttendance(s.id, student.id, selectedDate, st)")) {
  throw new Error("class attendance should save attendance per student");
}

console.log("attendance lesson hour rules checks passed");
