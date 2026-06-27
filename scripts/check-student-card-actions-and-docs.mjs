import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studentsPage = readFileSync("src/app/students/page.tsx", "utf8");
const summary = readFileSync("docs/conversation-summary.md", "utf8");
const plansReadme = readFileSync("docs/superpowers/plans/README.md", "utf8");

assert.match(
  studentsPage,
  /className="[^"]*inline-flex[^"]*items-center[^"]*justify-center[^"]*h-9[^"]*"/,
  "student detail action should use a fixed-height flex pill so its text is vertically centered"
);

assert.match(
  studentsPage,
  /className="[^"]*items-center[^"]*justify-end[^"]*"/,
  "student card action group should align controls through the center"
);

assert.match(
  summary,
  /截至 2026-06-26，前述后续计划均已完成/,
  "conversation summary should state that previously mentioned follow-up plans are complete"
);

assert.match(
  plansReadme,
  /已完成实施计划归档/,
  "plans directory should be clearly marked as completed implementation-plan archive"
);

console.log("Student card actions and docs completion notes are up to date.");
