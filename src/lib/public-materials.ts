import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_MATERIALS_DIR = path.join(process.cwd(), "storage", "public-materials");

export type PublicMaterial = {
  name: string;
  title: string;
  extension: string;
  size: number;
  updatedAt: string;
  type: "animation" | "paper" | "material";
  previewUrl: string;
  downloadUrl: string;
};

const allowedExtensions = new Set([".pdf", ".html", ".htm", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"]);
const mimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function isAllowedPublicMaterialExtension(extension: string) {
  return allowedExtensions.has(extension.toLowerCase());
}

export function getPublicMaterialMimeType(extension: string) {
  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}

export function getPublicMaterialType(extension: string): PublicMaterial["type"] {
  if (extension === ".html" || extension === ".htm") return "animation";
  if (extension === ".pdf" || extension === ".doc" || extension === ".docx") return "paper";
  return "material";
}

export function getPublicMaterialPath(fileName: string) {
  const safeName = path.basename(fileName);
  return path.join(PUBLIC_MATERIALS_DIR, safeName);
}

export function getPublicMaterialTitle(fileName: string) {
  return path.basename(fileName, path.extname(fileName)).replace(/[-_]+/g, " ");
}

export async function listPublicMaterials(): Promise<PublicMaterial[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(PUBLIC_MATERIALS_DIR);
  } catch {
    return [];
  }

  const materials = await Promise.all(entries.map(async (name) => {
    const extension = path.extname(name).toLowerCase();
    if (!isAllowedPublicMaterialExtension(extension)) return null;
    const fileStat = await stat(getPublicMaterialPath(name)).catch(() => null);
    if (!fileStat?.isFile()) return null;
    const encodedName = encodeURIComponent(name);
    return {
      name,
      title: getPublicMaterialTitle(name),
      extension,
      size: fileStat.size,
      updatedAt: fileStat.mtime.toISOString(),
      type: getPublicMaterialType(extension),
      previewUrl: `/api/public-materials/${encodedName}?mode=preview`,
      downloadUrl: `/api/public-materials/${encodedName}?mode=download`,
    };
  }));

  return materials
    .filter((material): material is PublicMaterial => Boolean(material))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
