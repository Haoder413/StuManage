import { prisma } from "@/lib/prisma";

type CurrentUser = {
  id: string;
  workspaceId: string;
  role: string;
};

type LessonVideoAccessTarget = {
  workspaceId: string;
  studentId: string;
  learningLinkId?: string | null;
};

export async function canAccessLessonVideo(user: CurrentUser, video: LessonVideoAccessTarget) {
  if (video.workspaceId !== user.workspaceId) return false;
  if (user.role === "admin" || user.role === "teacher" || user.role === "demo") return true;
  if (user.role !== "parent") return false;

  const link = await prisma.learningLink.findFirst({
    where: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      studentId: video.studentId,
      isActive: true,
      ...(video.learningLinkId ? { id: video.learningLinkId } : {}),
    },
    select: { id: true },
  });

  return Boolean(link);
}
