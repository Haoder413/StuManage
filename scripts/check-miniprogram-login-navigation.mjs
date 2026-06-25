import { readFileSync } from "node:fs";

const source = readFileSync("miniprogram/pages/login/index.js", "utf8");
const missing = [];

for (const snippet of [
  "wx.switchTab({",
  "url: \"/pages/home/index\"",
  "fail: (error)",
]) {
  if (!source.includes(snippet)) missing.push(snippet);
}

if (source.includes(".finally(() =>")) {
  missing.push("login page should not setData in finally after switchTab");
}

if (missing.length > 0) {
  console.error(`Mini program login navigation checks failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Mini program login navigation avoids stale-page updates.");
