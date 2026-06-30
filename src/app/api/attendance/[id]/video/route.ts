import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { deleteLessonVideo, uploadLessonVideo } from "@/lib/lesson-video-storage";

async function findAttendanceForVideo(id: string, workspaceId: string) {
  return prisma.attendance.findFirst({
    where: { id, workspaceId },
    include: {
      lessonVideo: true,
      learningLink: true,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const attendance = await findAttendanceForVideo(params.id, user.workspaceId);
  if (!attendance) return NextResponse.json({ error: "attendance not found" }, { status: 404 });
  if (user.role === "teacher" && attendance.learningLink?.teacherId && attendance.learningLink.teacherId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  let saved;
  try {
    saved = await uploadLessonVideo(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to save lesson video";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const title = String(formData.get("title") || file.name).trim();
  const video = await prisma.lessonVideo.upsert({
    where: { attendanceId: attendance.id },
    update: {
      title,
      storageProvider: saved.storageProvider,
      fileName: file.name,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      extension: saved.extension,
      size: saved.size,
      vodFileId: saved.vodFileId || null,
      vodMediaUrl: saved.vodMediaUrl || null,
      vodSubAppId: saved.vodSubAppId || null,
      cosObjectKey: saved.cosObjectKey || null,
      playbackDomain: saved.playbackDomain || null,
      uploadedById: user.id,
    },
    create: {
      workspaceId: user.workspaceId,
      attendanceId: attendance.id,
      studentId: attendance.studentId,
      learningLinkId: attendance.learningLinkId,
      scheduleId: attendance.scheduleId,
      title,
      storageProvider: saved.storageProvider,
      fileName: file.name,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      extension: saved.extension,
      size: saved.size,
      vodFileId: saved.vodFileId || null,
      vodMediaUrl: saved.vodMediaUrl || null,
      vodSubAppId: saved.vodSubAppId || null,
      cosObjectKey: saved.cosObjectKey || null,
      playbackDomain: saved.playbackDomain || null,
      uploadedById: user.id,
    },
  });

  if (attendance.lessonVideo) await deleteLessonVideo(attendance.lessonVideo);

  return NextResponse.json(video);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const attendance = await findAttendanceForVideo(params.id, user.workspaceId);
  if (!attendance) return NextResponse.json({ error: "attendance not found" }, { status: 404 });
  if (user.role === "teacher" && attendance.learningLink?.teacherId && attendance.learningLink.teacherId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.lessonVideo.deleteMany({ where: { attendanceId: attendance.id, workspaceId: user.workspaceId } });
  if (attendance.lessonVideo) await deleteLessonVideo(attendance.lessonVideo);

  return NextResponse.json({ success: true });
}
