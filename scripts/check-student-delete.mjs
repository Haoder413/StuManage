import { readFileSync } from "node:fs";

const checks = {
  "src/app/api/students/route.ts": [
    "export async function DELETE",
    "deleteMany",
    "workspaceId: user.workspaceId",
  ],
  "src/app/students/page.tsx": [
    "DeleteStudentButton",
  ],
  "src/components/delete-student-button.tsx": [
    "确认删除",
    "删除",
    "method: \"DELETE\"",
    "router.refresh()",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(checks)) {
  let source = "";
  try {
    source = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }

  for (const snippet of snippets) {
    if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Student delete checks failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Student delete support is present.");
