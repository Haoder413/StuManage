import fs from "node:fs";

const page = fs.readFileSync("src/app/parent/exams/page.tsx", "utf8");

const issues = [];

if (page.includes("learningLinkLabel")) {
  issues.push("src/app/parent/exams/page.tsx should not use learningLinkLabel for the parent exam selector");
}

if (!/label:\s*`\$\{link\.student\?\.(name)\s*\|\|\s*"学生"\}\s*·\s*\$\{link\.subject\}`/.test(page)) {
  issues.push("src/app/parent/exams/page.tsx should label exam learning links as student + subject only");
}

if (issues.length) {
  console.error(`Parent exam selector label check failed:\n- ${issues.join("\n- ")}`);
  process.exit(1);
}

console.log("Parent exam selector label check passed");
