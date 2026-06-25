import { readFileSync } from "node:fs";

const required = {
  "miniprogram/utils/api.js": [
    "normalizeHttpError",
    "HTTP 500",
    "服务器开小差了",
    "wx.showToast",
  ],
  "miniprogram/pages/exams/index.js": [".catch((error)", "loadError"],
  "miniprogram/pages/progress/index.js": [".catch((error)", "loadError"],
  "miniprogram/pages/resources/index.js": [".catch((error)", "loadError"],
  "miniprogram/pages/calendar/index.js": [".catch((error)", "loadError"],
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
  console.error(`Missing mini program API error snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program API errors are handled.");
