import fs from "node:fs";

const courseDetail = fs.readFileSync("src/app/courses/[id]/page.tsx", "utf8");
const coursesPage = fs.readFileSync("src/app/courses/page.tsx", "utf8");
const coursesRoute = fs.readFileSync("src/app/api/courses/route.ts", "utf8");

if (!courseDetail.includes('where: { status: "active" }')) {
  throw new Error("course detail should only load active student course records");
}

if (!courseDetail.includes("activeStudentCourses")) {
  throw new Error("course detail should de-duplicate displayed active students");
}

if (!coursesPage.includes('where: { status: "active" }')) {
  throw new Error("course list should only count active student course records");
}

if (!coursesPage.includes("selectedStudentCount")) {
  throw new Error("course list should de-duplicate active student counts");
}

if (!coursesRoute.includes('studentCourses: { where: { status: "active" } }')) {
  throw new Error("courses API should count only active student course records");
}

console.log("course active student checks passed");
