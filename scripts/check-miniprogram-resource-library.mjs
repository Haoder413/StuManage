import { readFileSync } from "node:fs";

const files = {
  "miniprogram/pages/resources/index.js": [
    "query", "courseId", "grade", "subject", "resourceKind", "hasNextPage", "loadMore", "files", "requestGeneration", "resource-webview",
  ],
  "miniprogram/pages/resources/index.wxml": [
    "bindinput=\"onQueryInput\"", "bindchange=\"onFilterChange\"", "item.files", "学生版", "答案版", "加载更多",
  ],
  "miniprogram/pages/resources/index.wxss": ["search-input", "filter-row", "file-row", "role-badge"],
};

const missing = [];
for (const [path, snippets] of Object.entries(files)) {
  const source = readFileSync(path, "utf8");
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${path}: ${snippet}`);
}
if (missing.length > 0) {
  console.error(`Mini-program resource library checks failed: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Mini-program resource library is present.");
