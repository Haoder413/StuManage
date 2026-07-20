import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { deleteStoredClassHomework } from "@/lib/attendance-file-storage";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const record = await prisma.attendanceClassHomework.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: { attendance: { include: { learningLink: true } } },
  });

  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (
    user.role === "teacher" &&
    record.attendance.learningLink?.teacherId &&
    record.attendance.learningLink.teacherId !== user.id
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.attendanceClassHomework.delete({ where: { id: record.id } });
  await deleteStoredClassHomework(record.storedName);

  return NextResponse.json({ success: true });
}
