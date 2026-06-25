import fs from "node:fs";

const studentPage = fs.readFileSync("src/app/students/[id]/page.tsx", "utf8");
const studentsRoute = fs.readFileSync("src/app/api/students/route.ts", "utf8");

if (!studentPage.includes("activeStudentCourses")) {
  throw new Error("student detail should derive active student courses");
}

if (!studentPage.includes("new Map(")) {
  throw new Error("student detail should de-duplicate displayed courses");
}

if (!studentsRoute.includes("currentActiveCourse")) {
  throw new Error("student API should detect unchanged active course before syncing");
}

if (!studentsRoute.includes("currentActiveCourse?.courseId === courseId")) {
  throw new Error("student API should skip course sync when course is unchanged");
}

console.log("student active course display checks passed");
