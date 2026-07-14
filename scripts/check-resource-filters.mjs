import { readFileSync } from "node:fs";

const files = {
  "src/lib/resource-library-validation.ts": ["grade", "year", "subject", "resourceKind", "fileState", "courseId", "pageSize"],
  "src/app/api/resource-groups/route.ts": ["resourceGradeSearchTerms", "query.grade", "query.year", "query.subject", "query.resourceKind", "query.fileState", "query.courseId"],
  "src/components/resource-search-toolbar.tsx": ["全部年级", "全部年份", "未设置年份", "全部科目", "全部类型", "学生版＋答案版", "全部清除"],
};

const missing = [];
for (const [file, snippets] of Object.entries(files)) {
  let source = "";
  try { source = readFileSync(file, "utf8"); } catch { missing.push(file); continue; }
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
}
if (missing.length > 0) {
  console.error(`Missing resource filter snippets: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Resource filters are present.");
