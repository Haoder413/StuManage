import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const studentsRoute = fs.readFileSync("src/app/api/students/route.ts", "utf8");
const attendanceRoute = fs.readFileSync("src/app/api/attendance/route.ts", "utf8");
const studentEditor = fs.readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");
const studentPage = fs.readFileSync("src/app/students/[id]/page.tsx", "utf8");

if (!schema.includes("model LessonHourLog")) {
  throw new Error("schema should include LessonHourLog");
}

if (!studentsRoute.includes("LESSON_HOUR_ACTIONS")) {
  throw new Error("students API should expose lesson hour action handling");
}

if (!attendanceRoute.includes("lessonHourLog")) {
  throw new Error("attendance API should write lesson hour logs");
}

if (studentEditor.includes("value={studentForm.totalLessonHours}") || studentEditor.includes("value={studentForm.remainingLessonHours}")) {
  throw new Error("student editor should not directly edit lesson hour numbers");
}

if (!studentEditor.includes("增加课时") || !studentEditor.includes("使用课时")) {
  throw new Error("student editor should provide lesson hour action buttons");
}

if (!studentPage.includes("课时历史") || !studentPage.includes("lessonHourLogs")) {
  throw new Error("student page should display lesson hour history");
}

console.log("lesson hour history checks passed");
