import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type LessonVideoStorageProvider = "local" | "vod" | "cos";

export type StoredLessonVideo = {
  storageProvider: LessonVideoStorageProvider;
  fileName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
  vodFileId?: string | null;
  vodMediaUrl?: string | null;
  vodSubAppId?: number | null;
  cosObjectKey?: string | null;
  playbackDomain?: string | null;
};

export type LessonVideoPlayback =
  | { kind: "local"; bytes: Buffer; mimeType: string; fileName: string }
  | { kind: "redirect"; url: string };

export const LESSON_VIDEO_UPLOAD_DIR = path.join(process.cwd(), "storage", "lesson-videos");

function getMaxLessonVideoBytes() {
  const configuredMb = Number(process.env.LESSON_VIDEO_MAX_MB || "2048");
  const maxMb = Number.isFinite(configuredMb) && configuredMb > 0 ? configuredMb : 2048;
  return Math.floor(maxMb * 1024 * 1024);
}

export const MAX_LESSON_VIDEO_BYTES = getMaxLessonVideoBytes();

const extensionToMime: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

export function getLessonVideoStorageProvider(): LessonVideoStorageProvider {
  const provider = process.env.LESSON_VIDEO_STORAGE_PROVIDER || "local";
  if (provider === "vod") return "vod";
  if (provider === "cos") return "cos";
  return "local";
}

export function getReservedCosLessonVideoShape(cosObjectKey: string): Pick<StoredLessonVideo, "storageProvider" | "cosObjectKey"> {
  return { storageProvider: "cos", cosObjectKey };
}

export function getLessonVideoExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedLessonVideoExtension(extension: string) {
  return [".mp4", ".webm", ".mov", ".m4v"].includes(extension);
}

export function getLessonVideoMimeType(extension: string, fallback: string) {
  return extensionToMime[extension] || fallback || "application/octet-stream";
}

export function getStoredLessonVideoPath(storedName: string) {
  return path.join(LESSON_VIDEO_UPLOAD_DIR, storedName);
}

function getVodSubAppId() {
  const value = process.env.TENCENT_VOD_SUB_APP_ID;
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getVodRegion() {
  return process.env.TENCENT_VOD_REGION || "ap-guangzhou";
}

async function fileToTempPath(file: File, extension: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_LESSON_VIDEO_BYTES) {
    throw new Error("lesson_video_too_large");
  }

  const tempPath = path.join(os.tmpdir(), `${randomUUID()}${extension}`);
  await writeFile(tempPath, bytes);
  return { tempPath, size: bytes.length };
}

export async function saveUploadedLessonVideoFile(file: File): Promise<StoredLessonVideo> {
  const extension = getLessonVideoExtension(file.name);
  if (!isAllowedLessonVideoExtension(extension)) {
    throw new Error("unsupported_lesson_video_type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_LESSON_VIDEO_BYTES) {
    throw new Error("lesson_video_too_large");
  }

  await mkdir(LESSON_VIDEO_UPLOAD_DIR, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(getStoredLessonVideoPath(storedName), bytes);

  return {
    storageProvider: "local",
    fileName: file.name,
    storedName,
    extension,
    size: bytes.length,
    mimeType: getLessonVideoMimeType(extension, file.type),
  };
}

export async function uploadLessonVideo(file: File): Promise<StoredLessonVideo> {
  const provider = getLessonVideoStorageProvider();
  if (provider === "vod") return uploadLessonVideoToVod(file);
  if (provider === "cos") {
    throw new Error("cos_lesson_video_storage_not_configured");
  }
  return saveUploadedLessonVideoFile(file);
}

export async function uploadLessonVideoToVod(file: File): Promise<StoredLessonVideo> {
  const extension = getLessonVideoExtension(file.name);
  if (!isAllowedLessonVideoExtension(extension)) {
    throw new Error("unsupported_lesson_video_type");
  }

  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("missing_tencent_vod_credentials");
  }

  const { tempPath, size } = await fileToTempPath(file, extension);
  try {
    const { VodUploadClient, VodUploadRequest } = require("vod-node-sdk");
    const client = new VodUploadClient(secretId, secretKey);
    const request = new VodUploadRequest();
    request.MediaFilePath = tempPath;
    request.MediaName = path.basename(file.name, extension);
    const subAppId = getVodSubAppId();
    if (subAppId) request.SubAppId = subAppId;
    if (process.env.TENCENT_VOD_PROCEDURE) request.Procedure = process.env.TENCENT_VOD_PROCEDURE;

    const response = await new Promise<any>((resolve, reject) => {
      client.upload(getVodRegion(), request, (error: Error | null, data: any) => {
        if (error) reject(error);
        else resolve(data);
      });
    });

    if (!response?.FileId) {
      throw new Error("vod_upload_missing_file_id");
    }

    return {
      storageProvider: "vod",
      fileName: file.name,
      storedName: response.FileId,
      extension,
      size,
      mimeType: getLessonVideoMimeType(extension, file.type),
      vodFileId: response.FileId,
      vodMediaUrl: response.MediaUrl || null,
      vodSubAppId: subAppId,
      playbackDomain: process.env.TENCENT_VOD_PLAY_DOMAIN || null,
    };
  } finally {
    try {
      await unlink(tempPath);
    } catch {}
  }
}

export async function deleteStoredLessonVideo(storedName?: string | null) {
  if (!storedName) return;
  try {
    await unlink(getStoredLessonVideoPath(storedName));
  } catch {}
}

export async function deleteVodLessonVideo(vodFileId?: string | null, vodSubAppId?: number | null) {
  if (!vodFileId) return;
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) return;

  const tencentcloud = require("tencentcloud-sdk-nodejs");
  const VodClient = tencentcloud.vod.v20180717.Client;
  const VodModels = tencentcloud.vod.v20180717.Models;
  const Credential = tencentcloud.common.Credential;
  const client = new VodClient(new Credential(secretId, secretKey), getVodRegion());
  const request = new VodModels.DeleteMediaRequest();
  request.FileId = vodFileId;
  if (vodSubAppId) request.SubAppId = vodSubAppId;

  await new Promise<void>((resolve) => {
    client.DeleteMedia(request, () => resolve());
  });
}

export async function deleteLessonVideo(video: {
  storageProvider?: string | null;
  storedName?: string | null;
  vodFileId?: string | null;
  vodSubAppId?: number | null;
}) {
  if (video.storageProvider === "vod") {
    await deleteVodLessonVideo(video.vodFileId, video.vodSubAppId);
    return;
  }
  await deleteStoredLessonVideo(video.storedName);
}

export async function getLessonVideoPlayback(video: {
  storageProvider?: string | null;
  storedName: string;
  fileName: string;
  mimeType: string;
  vodMediaUrl?: string | null;
}): Promise<LessonVideoPlayback> {
  if (video.storageProvider === "vod") {
    if (!video.vodMediaUrl) throw new Error("vod_video_missing_playback_url");
    return { kind: "redirect", url: video.vodMediaUrl };
  }

  if (video.storageProvider === "cos") {
    throw new Error("cos_lesson_video_storage_not_configured");
  }

  return {
    kind: "local",
    bytes: await readFile(getStoredLessonVideoPath(video.storedName)),
    mimeType: video.mimeType,
    fileName: video.fileName,
  };
}
