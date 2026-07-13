import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

assert.equal(existsSync("src/app/communication/page.tsx"), false, "communication overview page should be removed");
assert.equal(existsSync("src/app/communication/students/[id]/page.tsx"), false, "student communication page should be removed");
assert.equal(existsSync("src/app/api/communication/route.ts"), false, "communication API should be removed");

const checks = [
  ["src/components/sidebar.tsx", /\/communication|沟通记录/, "sidebar should not expose communication"],
  ["middleware.ts", /[\"']communication[\"']/, "middleware should not register communication"],
  ["src/app/students/[id]/page.tsx", /communicationLogs|\/communication|沟通记录/, "student detail page should not reference communication"],
  ["src/app/students/[id]/student-detail-editor.tsx", /CommunicationLog|communication|沟通记录/, "student detail editor should not reference communication"],
  ["prisma/schema.prisma", /CommunicationLog|communicationLogs/, "Prisma schema should not define communication records"],
  ["prisma/seed.ts", /communicationLog|commLogs|Communication Logs|沟通记录/, "seed should not create communication records"],
  ["src/types/index.ts", /CommunicationMethod/, "shared types should not define CommunicationMethod"],
];

for (const [path, pattern, message] of checks) {
  assert.doesNotMatch(read(path), pattern, message);
}

console.log("Communication feature has been completely removed.");
