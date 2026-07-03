import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(source, snippet, label) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${label}`);
  }
}

const coursesApi = read("src/app/api/courses/route.ts");
const parentScheduleApi = read("src/app/api/parent/schedule-items/route.ts");
const mobileCalendarApi = read("src/app/api/mobile/parent/calendar/route.ts");
const parentCalendar = read("src/components/parent-time-management-client.tsx");
const miniprogramCalendar = read("miniprogram/pages/calendar/index.js");
const manual = read("docs/操作手册.md");
const summary = read("docs/conversation-summary.md");

assertIncludes(coursesApi, "deleteSchedulesWithoutAttendance", "helper deleting schedules without attendance");
assertIncludes(coursesApi, "preserveAttendedSchedules", "helper preserving attended schedules");
assertIncludes(coursesApi, "attendance: { none: {} }", "course edit deletes only schedules without attendance");
assertIncludes(coursesApi, "attendance: { some: {} }", "course edit finds schedules with attendance");
assertIncludes(coursesApi, "removeMatchedDesiredSchedule", "course edit reuses matching attended schedule instead of duplicating it");
assertIncludes(coursesApi, "isActive: false", "course edit marks changed attended schedules as historical");
assertIncludes(parentScheduleApi, "attendance: { some:", "parent schedule API includes historical attended schedules");
assertIncludes(parentScheduleApi, "isActive: schedule.isActive", "parent schedule API exposes active state");
assertIncludes(mobileCalendarApi, "attendance: { some:", "mobile calendar API includes historical attended schedules");
assertIncludes(mobileCalendarApi, "isActive: schedule.isActive", "mobile calendar API exposes active state");
assertIncludes(parentCalendar, "isActive: boolean", "parent calendar has active state type");
assertIncludes(parentCalendar, "isHistoricalTeacherScheduleOnDate", "parent calendar shows inactive schedules only on attendance dates");
assertIncludes(miniprogramCalendar, "isHistoricalTeacherScheduleOnDate", "miniprogram calendar shows inactive schedules only on attendance dates");
assertIncludes(manual, "已记录考勤的旧课程安排不会被删除", "operation manual documents course edit attendance preservation");
assertIncludes(summary, "修改课程时间时保留已有考勤的旧排课", "conversation summary documents course edit attendance preservation");

console.log("course schedule attendance preservation checks passed");
