import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canAccessLessonAttachment } from "@/lib/lesson-attachment-access";
import { readStudentAnswerFile } from "@/lib/attendance-file-storage";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  const record = await prisma.attendanceStudentAnswer.findFirst({
    where: { id: params.id },
  });

  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = await canAccessLessonAttachment(user, record);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const bytes = await readStudentAnswerFile(record.storedName);
    const disposition = mode === "download" ? "attachment" : "inline";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
