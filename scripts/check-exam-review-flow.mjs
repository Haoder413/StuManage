import { readFileSync, existsSync } from "node:fs";

const files = {
  "src/app/api/exams/route.ts": ["reviewStatus", "pending_review", "learningLinkId", "requireCurrentUser"],
  "src/app/exams/page.tsx": ["待审核成绩", "reviewStatus", "/api/exams/review"],
  "src/app/exams/new/page.tsx": ["learningLinkId", "weakPointDescriptions"],
  "src/app/parent/exams/page.tsx": ["提交成绩", "pending_review", "officialExams", "learningLinkId"],
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

if (!existsSync("src/app/api/exams/review/route.ts")) {
  missing.push("src/app/api/exams/review/route.ts");
} else {
  const route = readFileSync("src/app/api/exams/review/route.ts", "utf8");
  for (const snippet of ["reviewStatus", "approved", "rejected", "rejectionReason", "getNextReviewDate", "weakPointDescriptions"]) {
    if (!route.includes(snippet)) missing.push(`src/app/api/exams/review/route.ts: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing exam review flow snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Exam review flow shape is present.");
