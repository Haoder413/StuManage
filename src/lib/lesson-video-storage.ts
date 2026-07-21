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

type UploadLessonVideoOptions = {
  workspaceId?: string;
};

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

function getCosRegion() {
  return process.env.TENCENT_COS_REGION || "ap-guangzhou";
}

function getLessonVideoPlaybackExpiresSeconds() {
  const configured = Number(process.env.LESSON_VIDEO_PLAYBACK_EXPIRES_SECONDS || "600");
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 600;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function getCosClient() {
  const COS = require("cos-nodejs-sdk-v5");
  return new COS({
    SecretId: getRequiredEnv("TENCENTCLOUD_SECRET_ID"),
    SecretKey: getRequiredEnv("TENCENTCLOUD_SECRET_KEY"),
  });
}

function buildLessonVideoCosObjectKey(extension: string, workspaceId?: string) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const safeWorkspaceId = (workspaceId || "default").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `lesson-videos/${safeWorkspaceId}/${year}/${month}/${randomUUID()}${extension}`;
}

function getCosPlaybackBaseUrl() {
  const configured = process.env.TENCENT_COS_PUBLIC_BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
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

export async function uploadLessonVideo(file: File, options: UploadLessonVideoOptions = {}): Promise<StoredLessonVideo> {
  const provider = getLessonVideoStorageProvider();
  if (provider === "vod") return uploadLessonVideoToVod(file);
  if (provider === "cos") return uploadLessonVideoToCos(file, options);
  return saveUploadedLessonVideoFile(file);
}

export async function uploadLessonVideoToCos(file: File, options: UploadLessonVideoOptions = {}): Promise<StoredLessonVideo> {
  const extension = getLessonVideoExtension(file.name);
  if (!isAllowedLessonVideoExtension(extension)) {
    throw new Error("unsupported_lesson_video_type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_LESSON_VIDEO_BYTES) {
    throw new Error("lesson_video_too_large");
  }

  const bucket = getRequiredEnv("TENCENT_COS_BUCKET");
  const region = getCosRegion();
  const cosObjectKey = buildLessonVideoCosObjectKey(extension, options.workspaceId);
  const mimeType = getLessonVideoMimeType(extension, file.type);
  const cos = getCosClient();

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: cosObjectKey,
        Body: bytes,
        ContentType: mimeType,
      },
      (error: Error | null) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });

  return {
    storageProvider: "cos",
    fileName: file.name,
    storedName: cosObjectKey,
    extension,
    size: bytes.length,
    mimeType,
    cosObjectKey,
    playbackDomain: getCosPlaybackBaseUrl() || null,
  };
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

export async function deleteCosLessonVideo(cosObjectKey?: string | null) {
  if (!cosObjectKey) return;
  const bucket = process.env.TENCENT_COS_BUCKET;
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!bucket || !secretId || !secretKey) return;

  const cos = getCosClient();
  await new Promise<void>((resolve, reject) => {
    cos.deleteObject(
      {
        Bucket: bucket,
        Region: getCosRegion(),
        Key: cosObjectKey,
      },
      (error: Error | null) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export async function deleteLessonVideo(video: {
  storageProvider?: string | null;
  storedName?: string | null;
  vodFileId?: string | null;
  vodSubAppId?: number | null;
  cosObjectKey?: string | null;
}) {
  if (video.storageProvider === "vod") {
    await deleteVodLessonVideo(video.vodFileId, video.vodSubAppId);
    return;
  }
  if (video.storageProvider === "cos") {
    try {
      await deleteCosLessonVideo(video.cosObjectKey || video.storedName);
    } catch (error) {
      console.error("Failed to delete COS lesson video", {
        cosObjectKey: video.cosObjectKey || video.storedName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }
  await deleteStoredLessonVideo(video.storedName);
}

export async function getCosLessonVideoPlaybackUrl(cosObjectKey?: string | null) {
  if (!cosObjectKey) throw new Error("cos_video_missing_object_key");
  const bucket = getRequiredEnv("TENCENT_COS_BUCKET");
  const region = getCosRegion();
  const expires = getLessonVideoPlaybackExpiresSeconds();
  const cos = getCosClient();
  const cdnDomain = getCosPlaybackBaseUrl();

  return new Promise<string>((resolve, reject) => {
    // 先用默认 COS 源站域名生成签名（签名包含正确的 host）
    cos.getObjectUrl(
      {
        Bucket: bucket,
        Region: region,
        Key: cosObjectKey,
        Sign: true,
        Expires: expires,
        Protocol: "https:",
      },
      (error: Error | null, data: { Url?: string }) => {
        if (error) reject(error);
        else if (!data?.Url) reject(new Error("cos_signed_url_missing"));
        else {
          // 若配置了 CDN 域名，将 URL 中的 COS 源站域名替换为 CDN 域名
          // 签名已基于正确 host 计算，CDN 回源时 Host 头不变，验签通过
          if (cdnDomain) {
            resolve(data.Url.replace(/https:\/\/[^/]+/, cdnDomain));
          } else {
            resolve(data.Url);
          }
        }
      }
    );
  });
}

export async function getLessonVideoPlayback(video: {
  storageProvider?: string | null;
  storedName: string;
  fileName: string;
  mimeType: string;
  vodMediaUrl?: string | null;
  cosObjectKey?: string | null;
}): Promise<LessonVideoPlayback> {
  if (video.storageProvider === "vod") {
    if (!video.vodMediaUrl) throw new Error("vod_video_missing_playback_url");
    return { kind: "redirect", url: video.vodMediaUrl };
  }

  if (video.storageProvider === "cos") {
    return { kind: "redirect", url: await getCosLessonVideoPlaybackUrl(video.cosObjectKey || video.storedName) };
  }

  return {
    kind: "local",
    bytes: await readFile(getStoredLessonVideoPath(video.storedName)),
    mimeType: video.mimeType,
    fileName: video.fileName,
  };
}
