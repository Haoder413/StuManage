import { readFileSync } from "node:fs";

const files = {
  "src/app/api/resources/route.ts": ["grade", "subject", "resourceKind", "teachingSubject"],
  "src/components/resource-center.tsx": [
    "gradeFilter",
    "subjectFilter",
    "resourceKindFilter",
    "资料属性",
    "动画",
    "试卷",
    "资料",
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
  console.error(`Missing resource filter snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Resource filters are present.");
