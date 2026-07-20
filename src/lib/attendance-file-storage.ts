import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ATTENDANCE_CLASS_HOMEWORK_DIR = path.join(process.cwd(), "storage", "attendance-homework");
export const ATTENDANCE_STUDENT_ANSWER_DIR = path.join(process.cwd(), "storage", "attendance-answers");

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

export function getAttendanceFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedAttendanceFileExtension(extension: string) {
  return [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".txt"].includes(extension);
}

export function getAttendanceFileMimeType(extension: string, fallback: string) {
  return extensionToMime[extension] || fallback || "application/octet-stream";
}

async function saveUploadedAttendanceFile(dir: string, file: File) {
  const extension = getAttendanceFileExtension(file.name);
  if (!isAllowedAttendanceFileExtension(extension)) {
    throw new Error("unsupported_attendance_file_type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(dir, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(path.join(dir, storedName), bytes);

  return {
    storedName,
    extension,
    size: bytes.length,
    mimeType: getAttendanceFileMimeType(extension, file.type),
  };
}

export function saveUploadedClassHomeworkFile(file: File) {
  return saveUploadedAttendanceFile(ATTENDANCE_CLASS_HOMEWORK_DIR, file);
}

export function saveUploadedStudentAnswerFile(file: File) {
  return saveUploadedAttendanceFile(ATTENDANCE_STUDENT_ANSWER_DIR, file);
}

export function readClassHomeworkFile(storedName: string) {
  return readFile(path.join(ATTENDANCE_CLASS_HOMEWORK_DIR, storedName));
}

export function readStudentAnswerFile(storedName: string) {
  return readFile(path.join(ATTENDANCE_STUDENT_ANSWER_DIR, storedName));
}

export async function deleteStoredClassHomework(storedName?: string | null) {
  if (!storedName) return;
  try {
    await unlink(path.join(ATTENDANCE_CLASS_HOMEWORK_DIR, storedName));
  } catch {}
}

export async function deleteStoredStudentAnswer(storedName?: string | null) {
  if (!storedName) return;
  try {
    await unlink(path.join(ATTENDANCE_STUDENT_ANSWER_DIR, storedName));
  } catch {}
}
