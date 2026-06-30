import { mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

export const HOMEWORK_UPLOAD_DIR = path.join(process.cwd(), "storage", "homework");
const execFileAsync = promisify(execFile);

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const teacherExtensions = [".pdf", ".doc", ".docx"];
const parentExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

export function getHomeworkExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedTeacherHomeworkExtension(extension: string) {
  return teacherExtensions.includes(extension);
}

export function isAllowedParentHomeworkExtension(extension: string) {
  return parentExtensions.includes(extension);
}

export function getHomeworkMimeType(extension: string, fallback: string) {
  return mimeByExtension[extension] || fallback || "application/octet-stream";
}

export function getStoredHomeworkPath(storedName: string) {
  return path.join(HOMEWORK_UPLOAD_DIR, storedName);
}

function isWordExtension(extension: string) {
  return extension === ".doc" || extension === ".docx";
}

function officeBinaryCandidates() {
  return [
    process.env.LIBREOFFICE_BIN,
    "libreoffice",
    "soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ].filter(Boolean) as string[];
}

export async function convertStoredHomeworkFileToPdf(file: {
  fileName: string;
  storedName: string;
  extension: string;
}) {
  if (file.extension === ".pdf") {
    const info = await stat(getStoredHomeworkPath(file.storedName));
    return {
      storedName: file.storedName,
      extension: ".pdf",
      size: info.size,
      mimeType: "application/pdf",
    };
  }

  if (!isWordExtension(file.extension)) return null;

  const sourcePath = getStoredHomeworkPath(file.storedName);
  const outputDir = path.join(HOMEWORK_UPLOAD_DIR, "previews");
  await mkdir(outputDir, { recursive: true });
  const generatedName = `${path.basename(file.storedName, file.extension)}.pdf`;
  const generatedPath = path.join(outputDir, generatedName);
  const finalStoredName = path.join("previews", `${randomUUID()}.pdf`);
  const finalPath = getStoredHomeworkPath(finalStoredName);

  for (const binary of officeBinaryCandidates()) {
    const profileDir = await mkdtemp(path.join(HOMEWORK_UPLOAD_DIR, "lo-profile-"));
    try {
      await execFileAsync(binary, [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        sourcePath,
      ], { timeout: 30000 });
      const info = await stat(generatedPath);
      await rename(generatedPath, finalPath);
      return {
        storedName: finalStoredName,
        extension: ".pdf",
        size: info.size,
        mimeType: "application/pdf",
      };
    } catch {
      // Try the next binary. If none works, callers can fall back to text preview.
    } finally {
      await rm(profileDir, { recursive: true, force: true });
    }
  }

  return null;
}

export async function saveHomeworkFile(
  file: File,
  options: { allowedFor: "teacher" | "parent" }
) {
  const extension = getHomeworkExtension(file.name);
  const allowed = options.allowedFor === "teacher"
    ? isAllowedTeacherHomeworkExtension(extension)
    : isAllowedParentHomeworkExtension(extension);

  if (!allowed) {
    throw new Error("unsupported_homework_file_type");
  }

  await mkdir(HOMEWORK_UPLOAD_DIR, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(getStoredHomeworkPath(storedName), bytes);

  return {
    fileName: file.name,
    storedName,
    extension,
    size: bytes.length,
    mimeType: getHomeworkMimeType(extension, file.type),
  };
}
