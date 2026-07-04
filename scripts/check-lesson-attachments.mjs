import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(file, snippet, label) {
  if (!file.includes(snippet)) {
    throw new Error(`${label}: missing ${snippet}`);
  }
}

const schema = read("prisma/schema.prisma");
const storage = read("src/lib/lesson-attachment-storage.ts");
const uploadRoute = read("src/app/api/attendance/[id]/attachments/route.ts");
const fileRoute = read("src/app/api/lesson-attachments/[id]/file/route.ts");
const access = read("src/lib/lesson-attachment-access.ts");
const schedulePage = read("src/app/schedule/page.tsx");
const parentData = read("src/lib/parent-data.ts");
const archivePage = read("src/app/parent/archive/page.tsx");

assertIncludes(schema, "model LessonAttachment", "schema should define lesson attachments");
assertIncludes(schema, "lessonAttachments LessonAttachment[]", "attendance should include lesson attachments");
assertIncludes(storage, "LESSON_ATTACHMENT_UPLOAD_DIR", "attachment storage directory");
assertIncludes(storage, "saveUploadedLessonAttachmentFile", "attachment storage should save uploaded files");
assertIncludes(access, "canAccessLessonAttachment", "attachment access should share lesson permissions");
assertIncludes(uploadRoute, "requireTeacherLike", "attachment upload should require teacher-like login");
assertIncludes(uploadRoute, "saveUploadedLessonAttachmentFile", "attachment upload should persist files");
assertIncludes(uploadRoute, "lessonAttachment.create", "attachment upload should create attachment records");
assertIncludes(fileRoute, "canAccessLessonAttachment", "attachment file route should check permissions");
assertIncludes(fileRoute, "mode === \"download\"", "attachment file route should support preview and download");
assertIncludes(schedulePage, "课堂资料", "teacher attendance dialog should show lesson attachment upload");
assertIncludes(schedulePage, "reviewAttachmentFiles", "teacher attendance dialog should track selected attachment files");
assertIncludes(parentData, "lessonAttachments", "parent data should load lesson attachments");
assertIncludes(archivePage, "课堂资料", "parent archive should show lesson attachments");
assertIncludes(archivePage, "/api/lesson-attachments/", "parent archive should link attachment files");

console.log("Lesson attachment checks passed.");
