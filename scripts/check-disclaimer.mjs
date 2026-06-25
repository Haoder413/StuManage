import { readFileSync } from "node:fs";

const required = {
  "src/components/site-disclaimer.tsx": [
    "个人学习分享博客",
    "网站备案持有人（管理员账号）独立创作发布",
    "注册用户仅可在个人中心存储私有学习备忘录",
    "用户无法上传内容",
    "网站无公开栏目",
    "无用户公开发布、评论互动功能",
  ],
  "src/app/disclaimer/page.tsx": ["SiteDisclaimer", "免责声明"],
  "src/app/login/page.tsx": ["SiteDisclaimer", "/disclaimer"],
  "src/components/resource-center.tsx": [
    "知识点动画、自编习题、学习笔记均由网站备案持有人（管理员账号）独立创作发布",
  ],
  "middleware.ts": ["/disclaimer"],
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
  console.error(`Missing disclaimer snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Disclaimer text is present.");
