import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { saveUploadedLessonAttachmentFile } from "@/lib/lesson-attachment-storage";

async function findAttendanceForAttachment(id: string, workspaceId: string) {
  return prisma.attendance.findFirst({
    where: { id, workspaceId },
    include: { learningLink: true },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const attendance = await findAttendanceForAttachment(params.id, user.workspaceId);
  if (!attendance) return NextResponse.json({ error: "attendance not found" }, { status: 404 });
  if (user.role === "teacher" && attendance.learningLink?.teacherId && attendance.learningLink.teacherId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    const file = formData.get("file");
    if (file instanceof File) files.push(file);
  }
  if (files.length === 0) return NextResponse.json({ error: "missing file" }, { status: 400 });

  try {
    const attachments = [];
    for (const file of files) {
      const saved = await saveUploadedLessonAttachmentFile(file);
      const attachment = await prisma.lessonAttachment.create({
        data: {
          workspaceId: user.workspaceId,
          attendanceId: attendance.id,
          studentId: attendance.studentId,
          learningLinkId: attendance.learningLinkId,
          scheduleId: attendance.scheduleId,
          title: String(formData.get("title") || file.name).trim(),
          fileName: file.name,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          extension: saved.extension,
          size: saved.size,
          uploadedById: user.id,
        },
      });
      attachments.push(attachment);
    }

    return NextResponse.json(attachments, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_save_lesson_attachment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
