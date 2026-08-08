import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/attendance/route.ts", "utf8");
const schedulesRoute = readFileSync("src/app/api/schedules/route.ts", "utf8");
const schedulePage = readFileSync("src/app/schedule/page.tsx", "utf8");

assert.match(route, /requestedLessonHourAmount/, "attendance API should read requested lesson hour amount");
assert.match(route, /currentAttendanceLessonHourDelta/, "attendance API should calculate current attendance lesson hour delta");
assert.match(route, /lessonHourAdjustment/, "attendance API should adjust by the difference instead of double-consuming");
assert.match(route, /remainingLessonHours: \{ gte: lessonHoursToConsume \}/, "attendance API should reject insufficient remaining hours");
assert.match(route, /deltaRemainingHours: lessonHourAdjustment/, "attendance API should record the actual variable lesson hour adjustment");

assert.match(schedulesRoute, /lessonHourLogs: true/, "schedules API should return attendance lesson hour logs");
assert.match(schedulePage, /reviewLessonHourAmount/, "attendance review dialog should track lesson hour amount");
assert.match(schedulePage, /本次扣课时/, "attendance review dialog should show lesson hour amount input");
assert.match(schedulePage, /lessonHourAmount: Number\(reviewLessonHourAmount\)/, "attendance save should submit selected decimal lesson hour amount");
assert.match(schedulePage, /getAttendanceLessonHourAmount/, "attendance dialog should prefill existing consumed lesson hours");

console.log("variable attendance lesson hour checks passed");
