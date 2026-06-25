import fs from "node:fs";

const route = fs.readFileSync("src/app/api/progress/route.ts", "utf8");

if (!route.includes("studentCourses")) {
  throw new Error("progress API should read active student courses");
}

if (!route.includes("not_started")) {
  throw new Error("progress API should synthesize missing course knowledge points as not_started");
}

if (!route.includes("progressKeys")) {
  throw new Error("progress API should de-duplicate stored and synthetic progress records");
}

console.log("progress course knowledge point checks passed");
