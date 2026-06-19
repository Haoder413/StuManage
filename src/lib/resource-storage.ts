import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const RESOURCE_UPLOAD_DIR = path.join(process.cwd(), "storage", "resources");

const extensionToMime: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
};

export function getResourceExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedResourceExtension(extension: string) {
  return [".pdf", ".doc", ".docx", ".html", ".htm"].includes(extension);
}

export function getResourceMimeType(extension: string, fallback: string) {
  return extensionToMime[extension] || fallback || "application/octet-stream";
}

export async function saveUploadedResourceFile(file: File) {
  const extension = getResourceExtension(file.name);
  if (!isAllowedResourceExtension(extension)) {
    throw new Error("unsupported_resource_type");
  }

  await mkdir(RESOURCE_UPLOAD_DIR, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(getStoredResourcePath(storedName), bytes);

  return {
    storedName,
    extension,
    size: bytes.length,
    mimeType: getResourceMimeType(extension, file.type),
  };
}

export function getStoredResourcePath(storedName: string) {
  return path.join(RESOURCE_UPLOAD_DIR, storedName);
}
