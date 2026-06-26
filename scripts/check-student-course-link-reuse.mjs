import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/students/route.ts", "utf8");

assert.match(route, /const inactiveCourseLink = await tx\.studentCourse\.findFirst/, "student course sync should look for an existing inactive course link");
assert.match(route, /tx\.studentCourse\.update\(\{ where: \{ id: inactiveCourseLink\.id \}, data: \{ status: "active" \} \}\)/, "student course sync should reactivate an existing link");
assert.match(route, /if \(inactiveCourseLink\) \{[\s\S]*\} else \{[\s\S]*tx\.studentCourse\.create/, "student course sync should only create when no reusable link exists");

console.log("Student course link reuse check passed.");
