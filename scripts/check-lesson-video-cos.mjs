import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(file, snippet, label) {
  if (!file.includes(snippet)) {
    throw new Error(`${label}: missing ${snippet}`);
  }
}

function assertNotIncludes(file, snippet, label) {
  if (file.includes(snippet)) {
    throw new Error(`${label}: unexpected ${snippet}`);
  }
}

const storage = read("src/lib/lesson-video-storage.ts");
const packageJson = read("package.json");
const nextConfig = read("next.config.mjs");

assertIncludes(packageJson, "\"cos-nodejs-sdk-v5\"", "COS SDK should be a direct dependency");
assertIncludes(nextConfig, "cos-nodejs-sdk-v5", "Next config should keep COS SDK external");

assertIncludes(storage, "TENCENT_COS_BUCKET", "COS bucket env should be read");
assertIncludes(storage, "TENCENT_COS_REGION", "COS region env should be read");
assertIncludes(storage, "TENCENT_COS_PUBLIC_BASE_URL", "COS playback base URL env should be read");
assertIncludes(storage, "LESSON_VIDEO_PLAYBACK_EXPIRES_SECONDS", "playback URL expiry should be configurable");
assertIncludes(storage, "uploadLessonVideoToCos", "COS upload adapter should exist");
assertIncludes(storage, "deleteCosLessonVideo", "COS delete adapter should exist");
assertIncludes(storage, "getCosLessonVideoPlaybackUrl", "COS playback URL helper should exist");
assertIncludes(storage, "lesson-videos", "COS object key should use lesson video prefix");
assertIncludes(storage, "cosObjectKey", "COS object key should be persisted");
assertIncludes(storage, "storageProvider: \"cos\"", "COS uploads should mark provider");
assertIncludes(storage, "getObjectUrl", "COS playback should generate object URLs");
assertIncludes(storage, "Sign: true", "COS playback URLs should be signed");
assertIncludes(storage, "putObject", "COS upload should put objects");
assertIncludes(storage, "deleteObject", "COS delete should delete objects");
assertNotIncludes(storage, "cos_lesson_video_storage_not_configured", "COS provider should not be a placeholder");

console.log("Lesson video COS storage support is present.");
