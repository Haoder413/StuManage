import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/schedules/route.ts", "utf8");

for (const operation of ["create", "update"]) {
  const callStart = source.indexOf(`prisma.schedule.${operation}({`);
  assert.notEqual(callStart, -1, `missing schedule ${operation} call`);

  const nextOperation = source.indexOf("prisma.schedule.", callStart + 1);
  const block = source.slice(callStart, nextOperation === -1 ? source.length : nextOperation);

  assert.match(block, /include:\s*{\s*student:\s*true,\s*attendance:\s*true\s*}/s, `schedule ${operation} must return student and attendance for the schedule page`);
}
