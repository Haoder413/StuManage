import { readFileSync } from "node:fs";

const files = {
  "src/lib/resource-library-validation.ts": ["grade", "year", "subject", "resourceKind", "fileState", "courseId", "pageSize"],
  "src/app/api/resource-groups/route.ts": ["resourceGradeSearchTerms", "query.grade", "query.year", "query.subject", "query.resourceKind", "query.fileState", "query.courseId"],
  "src/components/resource-search-toolbar.tsx": ["全部年级", "未设置年份", "targetParamsRef", "yearInput", 'type="number"', 'min="1900"', 'max="2100"', "全部科目", "全部类型", "学生版＋答案版", "全部清除"],
  "src/lib/resource-filter-state.ts": ["mergeResourceFilterParams", "parseResourceYearInput", "请输入 1900—2100 的年份"],
  "miniprogram/pages/resources/index.js": ['gradeOptions: ["全部年级", "初一", "初二", "初三"]', "yearInput", "parseMiniYearInput", "applyYearFilter", "filterUnsetYear"],
  "miniprogram/pages/resources/year-filter-state.js": ["parseMiniYearInput", "toggleMiniUnsetYear", "请输入 1900—2100 的年份"],
  "miniprogram/pages/resources/index.wxml": ['type="number"', 'bindconfirm="applyYearFilter"', 'bindtap="applyYearFilter"', 'bindtap="filterUnsetYear"'],
};

const missing = [];
for (const [file, snippets] of Object.entries(files)) {
  let source = "";
  try { source = readFileSync(file, "utf8"); } catch { missing.push(file); continue; }
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
}
const forbidden = {
  "src/components/resource-search-toolbar.tsx": ["小一", "小二", "小三", "小四", "小五", "小六", "高一", "高二", "高三", "2100 - 1900 + 1"],
  "miniprogram/pages/resources/index.js": ["小一", "小二", "小三", "小四", "小五", "小六", "高一", "高二", "高三", "yearOptions", "yearIndex", "2100 - 1900 + 1"],
  "miniprogram/pages/resources/index.wxml": ['bindblur="applyYearFilter"'],
};
for (const [file, snippets] of Object.entries(forbidden)) {
  const source = readFileSync(file, "utf8");
  for (const snippet of snippets) if (source.includes(snippet)) missing.push(`${file}: forbidden ${snippet}`);
}
if (missing.length > 0) {
  console.error(`Missing resource filter snippets: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Resource filters are present.");
