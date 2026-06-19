import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/schedule/page.tsx", "utf8");

assert.match(source, /function formatDateInput\(date: Date\)/, "schedule page should format date inputs from local dates");
assert.match(source, /s\.date \? formatDateInput\(new Date\(s\.date\)\) : formatDateInput\(selectedDate\)/, "editing a fixed schedule as flexible should default to the selected calendar date");
assert.match(source, /dayOfWeek: formType === "fixed" \? parseInt\(formDay\) : null/, "flexible schedules should not keep a fixed weekday");
assert.match(source, /date: formType === "flexible" \? formDate : null/, "fixed schedules should not keep a one-time date");
