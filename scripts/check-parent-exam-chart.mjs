import { readFileSync } from "node:fs";

const files = {
  "src/components/parent-exam-chart.tsx": [
    "use client",
    "LineChart",
    "formalScore",
    "quizScore",
    "ReferenceLine",
    "成绩趋势图",
  ],
  "src/app/parent/exams/page.tsx": [
    "ParentExamChart",
    "正式考试均分",
    "小测平均分",
    "最高",
    "最低",
    "进步幅度",
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

if (missing.length > 0) {
  console.error(`Missing parent exam chart snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent exam chart is present.");
