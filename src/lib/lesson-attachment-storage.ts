import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const LESSON_ATTACHMENT_UPLOAD_DIR = path.join(process.cwd(), "storage", "lesson-attachments");

const extensionToMime: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

export function getLessonAttachmentExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedLessonAttachmentExtension(extension: string) {
  return [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".txt"].includes(extension);
}

export function getLessonAttachmentMimeType(extension: string, fallback: string) {
  return extensionToMime[extension] || fallback || "application/octet-stream";
}

export function getStoredLessonAttachmentPath(storedName: string) {
  return path.join(LESSON_ATTACHMENT_UPLOAD_DIR, storedName);
}

export async function saveUploadedLessonAttachmentFile(file: File) {
  const extension = getLessonAttachmentExtension(file.name);
  if (!isAllowedLessonAttachmentExtension(extension)) {
    throw new Error("unsupported_lesson_attachment_type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(LESSON_ATTACHMENT_UPLOAD_DIR, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(getStoredLessonAttachmentPath(storedName), bytes);

  return {
    storedName,
    extension,
    size: bytes.length,
    mimeType: getLessonAttachmentMimeType(extension, file.type),
  };
}

export async function readLessonAttachmentFile(storedName: string) {
  return readFile(getStoredLessonAttachmentPath(storedName));
}

export async function deleteStoredLessonAttachment(storedName?: string | null) {
  if (!storedName) return;
  try {
    await unlink(getStoredLessonAttachmentPath(storedName));
  } catch {}
}
