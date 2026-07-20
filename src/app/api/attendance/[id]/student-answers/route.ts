import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { saveUploadedStudentAnswerFile } from "@/lib/attendance-file-storage";

async function findAttendanceForAnswer(id: string, workspaceId: string) {
  return prisma.attendance.findFirst({
    where: { id, workspaceId },
    include: { learningLink: true },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const attendance = await findAttendanceForAnswer(params.id, user.workspaceId);
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
    const records = [];
    for (const file of files) {
      const saved = await saveUploadedStudentAnswerFile(file);
      const record = await prisma.attendanceStudentAnswer.create({
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
      records.push(record);
    }

    return NextResponse.json(records, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_save_student_answer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
