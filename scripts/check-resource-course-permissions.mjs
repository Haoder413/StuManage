import { readFileSync } from "node:fs";

const files = {
  "prisma/schema.prisma": [
    "model ResourceCoursePermission",
    "courseId",
    "@@unique([resourceId, courseId])",
    "coursePermissions ResourceCoursePermission[]",
  ],
  "src/lib/resource-access.ts": [
    "getVisibleResourceWhere",
    "studentCourses",
    "coursePermissions",
  ],
  "src/app/api/resources/route.ts": [
    "getVisibleResourceWhere",
    "coursePermissions",
    "courseIds",
  ],
  "src/app/api/resource-permissions/route.ts": [
    "requireTeacherLike",
    "courseIds",
    "deleteMany",
    "createMany",
  ],
  "src/components/resource-center.tsx": [
    "授权课程",
    "CourseGrantPanel",
    "coursePermissions",
    "setSelectedCourseIds",
  ],
  "src/app/parent/resources/page.tsx": [
    "搜索已授权的课程资料",
  ],
};

const forbidden = {
  "src/components/resource-center.tsx": ["上锁"],
};

const missing = [];

for (const [file, snippets] of Object.entries(files)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

for (const [file, snippets] of Object.entries(forbidden)) {
  const text = readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (text.includes(snippet)) missing.push(`${file}: should not include ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Resource course permission checks failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Resource course permission shape is present.");
