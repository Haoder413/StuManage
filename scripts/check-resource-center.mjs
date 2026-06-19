import { readFileSync } from "node:fs";

const files = {
  "prisma/schema.prisma": [
    "model LearningResource",
    "model ResourcePermission",
    "uploadedById",
    "canPreview",
    "canDownload",
  ],
  "src/lib/resource-storage.ts": [
    "RESOURCE_UPLOAD_DIR",
    "saveUploadedResourceFile",
    "getStoredResourcePath",
  ],
  "src/lib/resource-access.ts": [
    "canManageResources",
    "canAccessResource",
    "isResourceControlledRole",
  ],
  "src/app/api/resources/route.ts": [
    "FormData",
    "saveUploadedResourceFile",
    "LearningResource",
    "locked",
  ],
  "src/app/api/resources/[id]/file/route.ts": [
    "canAccessResource",
    "Content-Disposition",
    "inline",
    "attachment",
  ],
  "src/app/api/resource-permissions/route.ts": [
    "requireAdmin",
    "resourceId",
    "userId",
    "canPreview",
    "canDownload",
  ],
  "src/app/resources/page.tsx": [
    "资料中心",
    "上传资料",
    "ResourceCenter",
  ],
  "src/app/parent/resources/page.tsx": [
    "资料中心",
    "ResourceCenter",
  ],
  "src/components/resource-center.tsx": [
    "上锁",
    "ResourceThumbnail",
    "sandbox=\"allow-scripts\"",
    "aspect-[16/9]",
    "预览",
    "下载",
    "授权",
    "试卷",
    "动画",
  ],
  "src/components/sidebar.tsx": ["资料中心", "/resources"],
  "src/components/parent-sidebar.tsx": ["资料中心", "/parent/resources"],
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

if (missing.length > 0) {
  console.error(`Missing resource center snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Resource center shape is present.");
