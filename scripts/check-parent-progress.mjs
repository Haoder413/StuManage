import { readFileSync, existsSync } from "node:fs";

const files = {
  "src/components/parent-sidebar.tsx": ["学习进度", "/parent/progress"],
  "src/app/parent/page.tsx": ["redirect(\"/parent/progress\")"],
  "src/lib/parent-data.ts": ["kpProgress", "knowledgePoint", "reviewSchedules", "dedupeWeakPoints"],
  "src/app/parent/progress/page.tsx": [
    "学习进度",
    "剩余课时",
    "知识点进度",
    "薄弱点复习",
    "整体进度",
    "reviewFilters",
    "filteredWeakPoints",
    "待复习",
    "已掌握",
    "最近复习",
  ],
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

if (existsSync("src/app/parent/schedule/page.tsx")) {
  missing.push("src/app/parent/schedule/page.tsx should be removed");
}

const parentProgressSource = readFileSync("src/app/parent/progress/page.tsx", "utf8");
for (const forbidden of ["记住了", "忘了", "markReviewCompleted", "markWeakpointMastered"]) {
  if (parentProgressSource.includes(forbidden)) {
    missing.push(`src/app/parent/progress/page.tsx should not include ${forbidden}`);
  }
}

const parentSidebarSource = readFileSync("src/components/parent-sidebar.tsx", "utf8");
if (parentSidebarSource.includes("孩子首页") || parentSidebarSource.includes("href: \"/parent\"")) {
  missing.push("src/components/parent-sidebar.tsx should remove child home navigation");
}

if (missing.length > 0) {
  console.error(`Missing parent progress snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent progress page is present.");
