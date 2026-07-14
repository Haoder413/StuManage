import { readFileSync } from "node:fs";

const files = {
  "prisma/schema.prisma": ["model ResourceGroup", "model ResourceFile", "model ResourceGroupPermission", "model ResourceGroupCoursePermission"],
  "src/lib/resource-storage.ts": ["RESOURCE_UPLOAD_DIR", "stageUploadedResourceFile", "commitStagedResourceFile", "getStoredResourcePath"],
  "src/lib/resource-group-access.ts": ["canManageResourceGroups", "canAccessResourceFile", "getVisibleResourceGroupWhere"],
  "src/app/api/resource-groups/route.ts": ["formData", "pageSize", "hasNextPage", "coursePermissions"],
  "src/app/api/resource-groups/[id]/files/[fileId]/route.ts": ["canAccessResourceFile", "Content-Disposition", "inline", "attachment", "sandbox allow-scripts"],
  "src/app/resources/page.tsx": ["资料中心", "ResourceCenter"],
  "src/app/parent/resources/page.tsx": ["资料中心", "ParentResourceLibrary"],
  "src/components/resource-center.tsx": ["ResourceUploadWizard", "ResourceSearchToolbar", "ResourceGroupList"],
  "src/components/resource-upload-wizard.tsx": ["批量上传资料", "学生版", "答案版", "multiple"],
  "src/components/resource-group-list.tsx": ["预览", "下载", "补传版本", "hasNextPage"],
  "src/components/sidebar.tsx": ["资料中心", "/resources"],
  "src/components/parent-sidebar.tsx": ["资料中心", "/parent/resources"],
};

const missing = [];
for (const [file, snippets] of Object.entries(files)) {
  let source = "";
  try { source = readFileSync(file, "utf8"); } catch { missing.push(file); continue; }
  for (const snippet of snippets) if (!source.includes(snippet)) missing.push(`${file}: ${snippet}`);
}
if (missing.length > 0) {
  console.error(`Missing resource center snippets: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Resource center shape is present.");
