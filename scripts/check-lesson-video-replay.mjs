import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(file, snippet, label) {
  if (!file.includes(snippet)) {
    throw new Error(`${label}: missing ${snippet}`);
  }
}

function assertMatches(file, pattern, label) {
  if (!pattern.test(file)) {
    throw new Error(`${label}: pattern ${pattern} not found`);
  }
}

const schema = read("prisma/schema.prisma");
const storage = read("src/lib/lesson-video-storage.ts");
const uploadRoute = read("src/app/api/attendance/[id]/video/route.ts");
const fileRoute = read("src/app/api/lesson-videos/[id]/file/route.ts");
const parentItemsRoute = read("src/app/api/parent/schedule-items/route.ts");
const parentClient = read("src/components/parent-time-management-client.tsx");
const schedulePage = read("src/app/schedule/page.tsx");
const serverInit = read("deploy/server-init.sh");

assertIncludes(schema, "model LessonVideo", "schema should define lesson videos");
assertIncludes(schema, "lessonVideo LessonVideo?", "attendance should expose one lesson video");
assertIncludes(schema, "@@unique([attendanceId])", "one video per attendance");
assertIncludes(schema, "storageProvider", "lesson video should record storage provider");
assertIncludes(schema, "vodFileId", "lesson video should record VOD file id");
assertIncludes(schema, "vodMediaUrl", "lesson video should record VOD media URL");
assertIncludes(schema, "cosObjectKey", "lesson video should reserve COS object key");

assertIncludes(storage, "LESSON_VIDEO_UPLOAD_DIR", "video storage directory");
assertIncludes(storage, "storage\", \"lesson-videos", "video storage path");
assertIncludes(storage, ".mp4", "mp4 allowed");
assertIncludes(storage, ".webm", "webm allowed");
assertIncludes(storage, "MAX_LESSON_VIDEO_BYTES", "video size limit");
assertIncludes(storage, "LESSON_VIDEO_MAX_MB", "video size limit should be configurable");
assertIncludes(storage, "2048", "default video size limit should align with nginx upload limit");
assertIncludes(storage, "getLessonVideoStorageProvider", "storage should expose provider selection");
assertIncludes(storage, "uploadLessonVideo", "storage should expose provider-agnostic upload");
assertIncludes(storage, "deleteLessonVideo", "storage should expose provider-agnostic delete");
assertIncludes(storage, "getLessonVideoPlayback", "storage should expose provider-agnostic playback");
assertIncludes(storage, "uploadLessonVideoToVod", "storage should support VOD upload adapter");
assertIncludes(storage, "storageProvider: \"vod\"", "VOD uploads should mark provider");
assertIncludes(storage, "storageProvider: \"cos\"", "COS provider should be reserved for later migration");

assertIncludes(uploadRoute, "requireTeacherLike", "upload route teacher permissions");
assertIncludes(uploadRoute, "uploadLessonVideo", "upload route saves video through adapter");
assertIncludes(uploadRoute, "lessonVideo.upsert", "upload route replaces existing video");
assertIncludes(uploadRoute, "storageProvider", "upload route persists storage provider");
assertIncludes(uploadRoute, "vodFileId", "upload route persists VOD id");
assertIncludes(uploadRoute, "DELETE", "upload route deletes video");
assertIncludes(uploadRoute, "lesson_video_too_large", "upload route should classify oversized videos");
assertIncludes(uploadRoute, "status: 413", "upload route should return request-too-large for oversized videos");

assertIncludes(fileRoute, "requireCurrentUser", "file route authenticates users");
assertIncludes(fileRoute, "canAccessLessonVideo", "file route checks video permissions");
assertIncludes(fileRoute, "getLessonVideoPlayback", "file route uses provider-agnostic playback");
assertIncludes(fileRoute, "NextResponse.redirect", "remote providers should redirect to playback URL");

assertIncludes(parentItemsRoute, "lessonVideo", "parent schedule API returns video metadata");
assertIncludes(parentItemsRoute, "videoUrl", "parent schedule API returns video URL");

assertIncludes(parentClient, "lessonVideo", "parent client models lesson video");
assertIncludes(parentClient, "<video", "parent client renders video player");
assertIncludes(parentClient, "课堂回放", "parent client labels replay section");

assertIncludes(schedulePage, "课堂视频", "teacher schedule dialog has video upload section");
assertMatches(schedulePage, /type="file"[\s\S]*accept="video\/mp4,video\/webm,video\/quicktime,video\/x-m4v"/, "teacher video input should limit video types");
assertIncludes(schedulePage, "renderAttendanceControls", "schedule page should centralize attendance controls");
assertIncludes(schedulePage, "修改", "recorded attendance should expose an edit action");
assertIncludes(schedulePage, "已记录", "recorded attendance should show a saved status instead of repeat action buttons");
assertIncludes(schedulePage, "视频超过系统上传上限", "teacher UI should explain application size limit");

assertIncludes(serverInit, "client_max_body_size 2048m;", "nginx should allow large lesson video uploads");
assertIncludes(serverInit, "proxy_read_timeout 1800s;", "nginx should keep long video uploads alive");
assertIncludes(serverInit, "proxy_send_timeout 1800s;", "nginx should keep long video uploads alive");

console.log("Lesson video replay support is present.");
