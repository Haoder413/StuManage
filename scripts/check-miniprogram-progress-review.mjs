import { readFileSync } from "node:fs";

const required = {
  "src/lib/mobile-parent-data.ts": [
    "pendingWeakPointCount",
    "consolidatingWeakPointCount",
    "completedWeakPointCount",
    "completedReviewCount",
    "reviewStageLabel",
    "lastReviewedAt",
    "masteredAt",
  ],
  "miniprogram/pages/progress/index.js": [
    "weakPointFilters",
    "filteredWeakPoints",
    "changeWeakPointFilter",
    "activeWeakPointFilter",
    "当前薄弱",
    "待复习",
    "全部",
    "巩固中",
    "已完成",
    "currentWeakPointCount",
    "pendingWeakPointCount",
    "completedReviewCount",
    "reviewStageText",
    "lastReviewedText",
  ],
  "miniprogram/pages/progress/index.wxml": [
    "薄弱点复习",
    "已复习",
    "最近复习",
    "bindtap=\"changeWeakPointFilter\"",
  ],
  "miniprogram/pages/progress/index.wxss": [
    ".weak-filter-row",
    ".weak-filter",
    ".weak-card",
    ".weak-status",
    ".next-review",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(required)) {
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
  console.error(`Missing mini program progress review snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program progress review display is present.");
