import { readFileSync, existsSync } from "node:fs";

const files = {
  "src/components/parent-sidebar.tsx": ["学习进度", "/parent/progress"],
  "src/lib/parent-data.ts": ["kpProgress", "knowledgePoint", "reviewSchedules"],
  "src/app/parent/progress/page.tsx": ["学习进度", "知识点进度", "薄弱点复习", "整体进度", "待复习"],
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

if (missing.length > 0) {
  console.error(`Missing parent progress snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent progress page is present.");
