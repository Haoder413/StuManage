import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const helperPath = "src/lib/lesson-hours.ts";
assert.equal(existsSync(helperPath), true, "lesson hour decimal helper should exist");

async function main() {
const { parseLessonHours, roundLessonHours } = await import("../src/lib/lesson-hours");

assert.equal(parseLessonHours("0.5", { allowZero: false }), 0.5);
assert.equal(parseLessonHours("1.25", { allowZero: false }), 1.25);
assert.equal(parseLessonHours("0.01", { allowZero: false }), 0.01);
assert.equal(parseLessonHours("1.234", { allowZero: false }), null);
assert.equal(parseLessonHours("0", { allowZero: false }), null);
assert.equal(parseLessonHours("-0.5"), null);
assert.equal(parseLessonHours("-0.5", { allowNegative: true }), -0.5);
assert.equal(parseLessonHours("not-a-number"), null);
assert.equal(roundLessonHours(0.1 + 0.2), 0.3);

const schema = readFileSync("prisma/schema.prisma", "utf8");
const attendanceRoute = readFileSync("src/app/api/attendance/route.ts", "utf8");
const studentsRoute = readFileSync("src/app/api/students/route.ts", "utf8");
const historyRoute = readFileSync("src/app/api/lesson-hour-logs/[id]/route.ts", "utf8");
const schedulePage = readFileSync("src/app/schedule/page.tsx", "utf8");
const studentEditor = readFileSync("src/app/students/[id]/student-detail-editor.tsx", "utf8");
const historyEditor = readFileSync("src/app/students/[id]/lesson-hour-history-editor.tsx", "utf8");
const deployScript = readFileSync("deploy/deploy-update.sh", "utf8");

assert.match(schema, /totalLessonHours\s+Float\s+@default\(0\)/);
assert.match(schema, /deltaRemainingHours\s+Float\s+@default\(0\)/);
assert.match(attendanceRoute, /parseLessonHours/);
assert.match(studentsRoute, /parseLessonHours/);
assert.match(historyRoute, /parseLessonHours/);
assert.match(schedulePage, /lessonHourAmount: Number\(reviewLessonHourAmount\)/);
assert.match(schedulePage, /roundLessonHours\([\s\S]*lessonHourLogs/);
assert.match(schedulePage, /step="0\.01"/);
assert.match(studentEditor, /amount: Number\(lessonHourForm\.amount\)/);
assert.match(studentEditor, /step="0\.01"/);
assert.match(historyEditor, /deltaTotalHours: Number\(form\.deltaTotalHours\)/);
assert.match(historyEditor, /step="0\.01"/);
assert.match(deployScript, /PRISMA_ACCEPT_DATA_LOSS/);
assert.match(deployScript, /--accept-data-loss/);
assert.match(deployScript, /DESTRUCTIVE_SCHEMA_MIGRATION_STARTED/);
assert.match(deployScript, /Automatic previous-release recovery is disabled/);

console.log("decimal lesson hour checks passed");
}

main();
