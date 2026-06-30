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
const schedulesApi = read("src/app/api/schedules/route.ts");
const schedulePage = read("src/app/schedule/page.tsx");
const parentScheduleItemsApi = read("src/app/api/parent/schedule-items/route.ts");
const mobileParentCalendarApi = read("src/app/api/mobile/parent/calendar/route.ts");
const miniprogramCalendarPage = read("miniprogram/pages/calendar/index.js");
const newCoursePage = read("src/app/courses/new/page.tsx");
const editCourseForm = read("src/app/courses/[id]/edit/course-edit-form.tsx");
const editCoursePage = read("src/app/courses/[id]/edit/page.tsx");
const studentsApi = read("src/app/api/students/route.ts");
const operationManual = read("docs/操作手册.md");

assertMatches(schema, /model CourseScheduleTime[\s\S]*startDate\s+DateTime\?[\s\S]*endDate\s+DateTime\?/, "CourseScheduleTime date range fields");
assertIncludes(newCoursePage, "selectedDays", "new course weekday multi-select state");
assertIncludes(newCoursePage, "toggleScheduleDay", "new course weekday toggle handler");
assertIncludes(newCoursePage, "开始日期", "new course start date field");
assertIncludes(newCoursePage, "截止日期", "new course end date field");
assertIncludes(editCourseForm, "selectedDays", "edit course weekday multi-select state");
assertIncludes(editCourseForm, "toggleScheduleDay", "edit course weekday toggle handler");
assertIncludes(editCourseForm, "开始日期", "edit course start date field");
assertIncludes(editCourseForm, "截止日期", "edit course end date field");
assertIncludes(editCoursePage, "startDate: time.startDate ? time.startDate.toISOString() : null", "edit page passes schedule start date");
assertIncludes(editCoursePage, "endDate: time.endDate ? time.endDate.toISOString() : null", "edit page passes schedule end date");
assertIncludes(coursesApi, "dayOfWeeks", "course API accepts weekday arrays");
assertIncludes(coursesApi, "parseOptionalDate(item.startDate)", "course API normalizes start date");
assertIncludes(coursesApi, "parseOptionalDate(item.endDate)", "course API normalizes end date");
assertIncludes(coursesApi, "startDate: time.startDate", "course API syncs start date to schedules");
assertIncludes(coursesApi, "endDate: time.endDate", "course API syncs end date to schedules");
assertIncludes(studentsApi, "startDate: time.startDate", "student course schedule sync keeps start date");
assertIncludes(studentsApi, "endDate: time.endDate", "student course schedule sync keeps end date");
assertIncludes(schedulesApi, "startDate", "schedules API exposes date ranges");
assertIncludes(schedulePage, "isScheduleInDateRange", "calendar filters fixed schedules by date range");
assertIncludes(parentScheduleItemsApi, "startDate: schedule.startDate", "parent schedule API exposes teacher schedule start date");
assertIncludes(parentScheduleItemsApi, "endDate: schedule.endDate", "parent schedule API exposes teacher schedule end date");
assertIncludes(mobileParentCalendarApi, "startDate: schedule.startDate ? formatCalendarDate(schedule.startDate) : null", "mobile parent calendar exposes teacher schedule start date");
assertIncludes(mobileParentCalendarApi, "endDate: schedule.endDate ? formatCalendarDate(schedule.endDate) : null", "mobile parent calendar exposes teacher schedule end date");
assertIncludes(miniprogramCalendarPage, "inTeacherScheduleRange", "miniprogram filters fixed teacher schedules by date range");
assertIncludes(operationManual, "每组课程时间可选择周一到周日中的多个上课日", "operation manual course schedule multi-day rule");
assertIncludes(operationManual, "开始日期和截止日期", "operation manual course schedule date range rule");

console.log("course schedule range and weekdays checks passed");
