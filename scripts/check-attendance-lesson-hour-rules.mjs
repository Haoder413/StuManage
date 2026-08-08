import fs from "node:fs";

const route = fs.readFileSync("src/app/api/attendance/route.ts", "utf8");
const schedulePage = fs.readFileSync("src/app/schedule/page.tsx", "utf8");

if (!route.includes('isPresentAttendance = data.status === "present"')) {
  throw new Error("attendance API should only consume lesson hours for present attendance");
}

if (!route.includes("currentAttendanceLessonHourDelta")) {
  throw new Error("attendance API should calculate current lesson hour consumption before saving");
}

if (!route.includes("remainingLessonHours: { gte: lessonHoursToConsume }")) {
  throw new Error("attendance API should not decrement remaining lesson hours below zero");
}

if (!route.includes("lessonHourAdjustment")) {
  throw new Error("attendance API should adjust consumed lesson hours by difference");
}

if (!schedulePage.includes("lessonHourAmount: Number(reviewLessonHourAmount)")) {
  throw new Error("attendance review should submit selected lesson hour amount");
}

if (!schedulePage.includes("handleAttendance(schedule.id, student.id, selectedDate, status)")) {
  throw new Error("class attendance should save attendance per student");
}

console.log("attendance lesson hour rules checks passed");
