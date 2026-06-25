import fs from "node:fs";

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const schema = read("prisma/schema.prisma");
const coursesApi = read("src/app/api/courses/route.ts");
const schedulesApi = read("src/app/api/schedules/route.ts");
const coursesPage = read("src/app/courses/page.tsx");
const courseDetail = read("src/app/courses/[id]/page.tsx");
const editPage = read("src/app/courses/[id]/edit/page.tsx");
const editForm = read("src/app/courses/[id]/edit/course-edit-form.tsx");

if (!schema.includes("isActive")) {
  throw new Error("Schedule should support hiding old generated schedules");
}

if (!coursesApi.includes("export async function PATCH")) {
  throw new Error("courses API should support editing courses");
}

if (!coursesApi.includes("syncCourseSchedules")) {
  throw new Error("courses API should sync generated schedules when editing");
}

if (!schedulesApi.includes("isActive: true")) {
  throw new Error("schedules API should only return active schedules");
}

if (!coursesPage.includes("/edit")) {
  throw new Error("course list should expose edit link");
}

if (!courseDetail.includes("编辑课程")) {
  throw new Error("course detail should expose edit button");
}

if (!editPage.includes("CourseEditForm")) {
  throw new Error("course edit page should render CourseEditForm");
}

if (!editForm.includes("method: \"PATCH\"")) {
  throw new Error("course edit form should submit PATCH");
}

console.log("course edit sync checks passed");
