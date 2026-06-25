import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/schedules/route.ts", "utf8");

const operations = [
  { name: "create", needle: "prisma.schedule.create({" },
  { name: "update response", needle: "prisma.schedule.findFirst({" },
];

for (const operation of operations) {
  const callStart = source.indexOf(operation.needle);
  assert.notEqual(callStart, -1, `missing schedule ${operation.name} call`);

  const nextOperation = source.indexOf("prisma.schedule.", callStart + 1);
  const block = source.slice(callStart, nextOperation === -1 ? source.length : nextOperation);

  assert.match(block, /include:\s*{/s, `schedule ${operation.name} must include related data`);
  assert.match(block, /student:\s*true/, `schedule ${operation.name} must return student for the schedule page`);
  assert.match(block, /attendance:\s*true/, `schedule ${operation.name} must return attendance for the schedule page`);
  assert.match(block, /course:\s*{/, `schedule ${operation.name} must return course data for course schedules`);
}
