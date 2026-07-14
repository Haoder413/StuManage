import { readFileSync } from "node:fs";

const files = {
  "prisma/schema.prisma": ["model ResourceGroupCoursePermission", "@@unique([groupId, courseId])", "coursePermissions ResourceGroupCoursePermission[]"],
  "src/lib/resource-group-access.ts": ["getVisibleResourceGroupWhere", "learningLinks", "isActive: true", "coursePermissions"],
  "src/app/api/resource-groups/route.ts": ["getVisibleResourceGroupWhere", "coursePermissions", "courseIds"],
  "src/app/api/resource-groups/batch-courses/route.ts": ["requireTeacherLike", "addCourseIds", "removeCourseIds", "deleteMany", "upsert"],
  "src/components/resource-course-dialog.tsx": ["课程分发", "addCourseIds", "removeCourseIds"],
  "src/app/parent/resources/page.tsx": ["搜索已授权的课程资料"],
};

const missing = [];
for (const [file, snippets] of Object.entries(files)) {
  let source = "";
  try { source = readFileSync(file, "utf8"); } catch { missing.push(file); continue; }
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
}
if (missing.length > 0) {
  console.error(`Resource course permission checks failed: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Resource course permission shape is present.");
