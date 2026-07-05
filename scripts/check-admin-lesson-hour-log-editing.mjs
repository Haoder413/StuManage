import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

const route = read("src/app/api/lesson-hour-logs/[id]/route.ts");
const historyEditor = read("src/app/students/[id]/lesson-hour-history-editor.tsx");
const studentPage = read("src/app/students/[id]/page.tsx");

assert.match(route, /requireAdmin/, "lesson hour log editing should require admin");
assert.match(route, /deltaTotalHours/, "route should accept total lesson hour delta");
assert.match(route, /deltaRemainingHours/, "route should accept remaining lesson hour delta");
assert.match(route, /totalLessonHours: \{ increment: totalAdjustment \}/, "editing/deleting should adjust student total lesson hours");
assert.match(route, /remainingLessonHours: \{ increment: remainingAdjustment \}/, "editing/deleting should adjust student remaining lesson hours");
assert.match(route, /nextTotalLessonHours < 0/, "route should reject negative total lesson hours");
assert.match(route, /nextRemainingLessonHours < 0/, "route should reject negative remaining lesson hours");
assert.match(route, /export async function PATCH/, "route should edit lesson hour logs");
assert.match(route, /export async function DELETE/, "route should delete lesson hour logs");

assert.match(historyEditor, /编辑/, "student lesson hour history should expose edit action");
assert.match(historyEditor, /删除/, "student lesson hour history should expose delete action");
assert.match(historyEditor, /isAdmin/, "history actions should be admin-only in the UI");
assert.match(historyEditor, /window\.location\.reload/, "history changes should refresh linked student stats");
assert.match(studentPage, /LessonHourHistoryEditor/, "student page should use the editable history component");

console.log("admin lesson hour log editing checks passed");
