import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const RESOURCE_UPLOAD_DIR = path.join(process.cwd(), "storage", "resources");
export const RESOURCE_STAGING_DIR = path.join(RESOURCE_UPLOAD_DIR, ".staging");

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

export function createResourceStoredName(extension: string) {
  const normalizedExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (!isAllowedResourceExtension(normalizedExtension)) throw new Error("unsupported_resource_type");
  return `${randomUUID()}${normalizedExtension}`;
}

export function hashResourceBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function resourceContentMatches(extension: string, bytes: Buffer) {
  if (extension === ".pdf") return bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  if (extension === ".docx") return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (extension === ".doc") {
    const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    return bytes.length >= oleHeader.length && bytes.subarray(0, oleHeader.length).equals(oleHeader);
  }
  if (extension === ".html" || extension === ".htm") {
    const start = bytes.subarray(0, 4096).toString("utf8").toLowerCase();
    return ["<!doctype html", "<html", "<head", "<body", "<svg"].some((marker) => start.includes(marker));
  }
  return false;
}

export type StagedResourceFile = {
  storedName: string;
  stagedPath: string;
  extension: string;
  size: number;
  mimeType: string;
  sha256: string;
};

export async function stageUploadedResourceFile(file: File): Promise<StagedResourceFile> {
  const extension = getResourceExtension(file.name);
  if (!isAllowedResourceExtension(extension)) {
    throw new Error("unsupported_resource_type");
  }

  const storedName = createResourceStoredName(extension);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!resourceContentMatches(extension, bytes)) throw new Error("resource_content_mismatch");
  await mkdir(RESOURCE_STAGING_DIR, { recursive: true });
  const stagedPath = path.join(RESOURCE_STAGING_DIR, `${randomUUID()}.upload`);
  await writeFile(stagedPath, bytes);

  return {
    storedName,
    stagedPath,
    extension,
    size: bytes.length,
    mimeType: getResourceMimeType(extension, file.type),
    sha256: hashResourceBytes(bytes),
  };
}

export async function commitStagedResourceFile(staged: StagedResourceFile) {
  await mkdir(RESOURCE_UPLOAD_DIR, { recursive: true });
  await rename(staged.stagedPath, getStoredResourcePath(staged.storedName));
}

export async function removeStagedResourceFile(staged: Pick<StagedResourceFile, "stagedPath">) {
  await rm(staged.stagedPath, { force: true });
}

export async function removeStoredResourceFile(storedName: string) {
  await rm(getStoredResourcePath(storedName), { force: true });
}

export async function cloneStoredResourceFile(storedName: string, extension: string) {
  const clonedName = createResourceStoredName(extension);
  await mkdir(RESOURCE_UPLOAD_DIR, { recursive: true });
  await copyFile(getStoredResourcePath(storedName), getStoredResourcePath(clonedName));
  return clonedName;
}

export async function saveUploadedResourceFile(file: File) {
  const staged = await stageUploadedResourceFile(file);
  try {
    await commitStagedResourceFile(staged);
    return staged;
  } catch (error) {
    await removeStagedResourceFile(staged);
    throw error;
  }
}

export function getStoredResourcePath(storedName: string) {
  return path.join(RESOURCE_UPLOAD_DIR, storedName);
}
