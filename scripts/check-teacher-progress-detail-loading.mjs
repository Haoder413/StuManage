import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync("src/app/progress/students/[id]/page.tsx", "utf8");
const route = readFileSync("src/app/api/progress/route.ts", "utf8");

assert.match(page, /try\s*{[\s\S]*finally\s*{[\s\S]*setLoading\(false\)/, "teacher progress detail loading should always finish");
assert.match(page, /Array\.isArray\(allProgress\)/, "teacher progress detail should guard malformed progress responses");
assert.match(page, /Array\.isArray\(allStudents\)/, "teacher progress detail should guard malformed student responses");
assert.doesNotMatch(page, /fetch\(`\/api\/courses\?id=\$\{c\.id\}`\)/, "teacher progress detail should not block loading on unused per-course fetches");
assert.match(
  page,
  /fetch\(`\/api\/progress\?studentId=\$\{encodeURIComponent\(studentId\)\}`\)/,
  "teacher progress detail should request progress for only the current student",
);
assert.match(
  page,
  /calculateConsistentProgressStatuses/,
  "teacher progress detail should derive parent status from child status on load",
);
assert.match(route, /export async function GET\(request: NextRequest\)/, "progress GET should accept the request query");
assert.match(
  route,
  /searchParams\.get\("studentId"\)/,
  "progress GET should read the optional studentId filter",
);
assert.match(
  route,
  /visibleStudentByIdWhere\(user, studentId\)/,
  "progress GET should validate filtered student visibility",
);
assert.match(
  route,
  /knowledgePoint:\s*{\s*select:/,
  "progress GET should select only required knowledge point fields",
);
assert.doesNotMatch(
  route,
  /course:\s*studentCourse\.course/,
  "synthetic progress should not embed the full course knowledge point tree in every row",
);
assert.match(
  page,
  /Boolean\(b\.learningLinkId\)/,
  "teacher progress detail should prefer linked progress over duplicate legacy rows",
);
assert.match(
  route,
  /findLearningLinkForTeacherStudent\([\s\S]*changedKnowledgePoint\.courseId/,
  "progress updates should resolve the learning link for the knowledge point course",
);

console.log("Teacher progress detail loading checks passed.");
