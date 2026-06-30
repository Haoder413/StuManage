import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canAccessLessonVideo } from "@/lib/lesson-video-access";
import { getLessonVideoPlayback } from "@/lib/lesson-video-storage";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const video = await prisma.lessonVideo.findFirst({
    where: { id: params.id },
  });

  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = await canAccessLessonVideo(user, video);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const playback = await getLessonVideoPlayback(video);
    if (playback.kind === "redirect") {
      return NextResponse.redirect(playback.url);
    }

    return new NextResponse(new Uint8Array(playback.bytes), {
      headers: {
        "Content-Type": playback.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(playback.fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
