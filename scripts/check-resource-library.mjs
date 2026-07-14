import { readFileSync } from "node:fs";

const required = {
  "prisma/schema.prisma": [
    "model ResourceGroup", "model ResourceFile", "model ResourceTag", "model ResourceGroupCoursePermission", "legacyResourceId", "totalSize",
  ],
  "src/lib/deepseek-resource-naming.ts": ["DEEPSEEK_API_KEY", "deepseek-chat", "validateAnalysisResult", "fileNames"],
  "src/app/api/resource-groups/route.ts": ["pageSize", "hasNextPage", "stageUploadedResourceFile", "sha256", "duplicate_file"],
  "src/app/api/resource-groups/[id]/files/[fileId]/route.ts": ["Content-Security-Policy", "sandbox allow-scripts", "canAccessResourceFile"],
  "src/components/resource-upload-wizard.tsx": ["multiple", "analyze-names", "只分析文件名", "needsConfirmation"],
  "src/components/resource-group-list.tsx": ["selectedGroupIds", "hasNextPage", "补传版本"],
  "src/app/parent/resources/page.tsx": ["ParentResourceLibrary", "learningLink", "isActive: true"],
  "src/lib/mobile-parent-data.ts": ["resourceGroup.findMany", "hasNextPage", "files:"],
};

const missing = [];
for (const [path, snippets] of Object.entries(required)) {
  const source = readFileSync(path, "utf8");
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${path}: ${snippet}`);
}
const browserSources = [
  "src/components/resource-upload-wizard.tsx",
  "src/components/resource-group-list.tsx",
  "src/components/resource-center.tsx",
].map((path) => readFileSync(path, "utf8")).join("\n");
if (browserSources.includes("api.deepseek.com")) missing.push("DeepSeek must not be called from browser components");

if (missing.length > 0) {
  console.error(`Resource library checks failed: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("AI resource library shape is present.");
