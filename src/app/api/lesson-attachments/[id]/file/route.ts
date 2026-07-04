import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canAccessLessonAttachment } from "@/lib/lesson-attachment-access";
import { readLessonAttachmentFile } from "@/lib/lesson-attachment-storage";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  const attachment = await prisma.lessonAttachment.findFirst({
    where: { id: params.id },
  });

  if (!attachment) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = await canAccessLessonAttachment(user, attachment);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const bytes = await readLessonAttachmentFile(attachment.storedName);
    const disposition = mode === "download" ? "attachment" : "inline";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
