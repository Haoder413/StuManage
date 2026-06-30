import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(file, text, label) {
  if (!file.includes(text)) {
    throw new Error(`Missing ${label}`);
  }
}

function assertMatches(file, pattern, label) {
  if (!pattern.test(file)) {
    throw new Error(`Missing ${label}`);
  }
}

const schema = read("prisma/schema.prisma");
const coursesApi = read("src/app/api/courses/route.ts");
const studentsApi = read("src/app/api/students/route.ts");
const schedulesApi = read("src/app/api/schedules/route.ts");
const schedulePage = read("src/app/schedule/page.tsx");
const courseDetailPage = read("src/app/courses/[id]/page.tsx");
const newCoursePage = read("src/app/courses/new/page.tsx");

assertIncludes(schema, "model CourseScheduleTime", "CourseScheduleTime model");
assertIncludes(schema, "defaultCapacity Int?", "Course.defaultCapacity");
assertMatches(schema, /courseId\s+String\?/, "Schedule.courseId");
assertMatches(schema, /studentId\s+String\?/, "optional Schedule.studentId");
assertIncludes(coursesApi, "scheduleTimes", "course creation scheduleTimes handling");
assertIncludes(studentsApi, "syncStudentCourseAndSchedules", "student course switching sync helper");
assertIncludes(schedulesApi, "studentCourses", "course schedule student list include");
assertIncludes(schedulePage, "courseAttendanceStudentId", "course attendance per-student state");
assertIncludes(schedulePage, "displayName", "schedule displayName helper");
assertIncludes(coursesApi, "export async function DELETE", "course delete API");
assertIncludes(coursesApi, "deleteMany({ where: { id, workspaceId: user.workspaceId } })", "workspace-scoped course deletion");
assertIncludes(courseDetailPage, "DeleteCourseButton", "course detail delete button");
assertIncludes(coursesApi, "studentIds", "course creation studentIds handling");
assertIncludes(newCoursePage, "selectedStudentIds", "new course selected student state");
assertIncludes(newCoursePage, "选择学生", "new course student selector");

console.log("course management refactor checks passed");
