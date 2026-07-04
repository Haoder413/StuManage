import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { deleteStoredLessonAttachment } from "@/lib/lesson-attachment-storage";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const attachment = await prisma.lessonAttachment.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: { attendance: { include: { learningLink: true } } },
  });

  if (!attachment) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (
    user.role === "teacher" &&
    attachment.attendance.learningLink?.teacherId &&
    attachment.attendance.learningLink.teacherId !== user.id
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.lessonAttachment.delete({ where: { id: attachment.id } });
  await deleteStoredLessonAttachment(attachment.storedName);

  return NextResponse.json({ success: true });
}
