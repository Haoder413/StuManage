import { readFileSync } from "node:fs";

const required = {
  "miniprogram/utils/api.js": [
    "timeout:",
    "normalizeRequestError",
    "接口连接超时",
    "wx.showToast",
  ],
  "miniprogram/app.js": [
    "localApiBaseUrl",
    "productionApiBaseUrl",
  ],
  "miniprogram/pages/exams/index.wxml": [
    "canvas",
    "chart-canvas",
    "trend-label",
  ],
  "miniprogram/pages/exams/index.js": [
    "drawCharts",
    "drawStudentChart",
    "chartPoints",
    "createSelectorQuery",
  ],
  "miniprogram/pages/exams/index.wxss": [
    ".chart-card",
    ".chart-canvas",
    ".chart-empty",
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
  console.error(`Missing mini program exam chart snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program exam chart support is present.");
