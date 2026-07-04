import { prisma } from "@/lib/prisma";

type CurrentUser = {
  id: string;
  workspaceId: string;
  role: string;
};

type LessonAttachmentAccessTarget = {
  workspaceId: string;
  studentId: string;
  learningLinkId?: string | null;
};

export async function canAccessLessonAttachment(user: CurrentUser, attachment: LessonAttachmentAccessTarget) {
  if (attachment.workspaceId !== user.workspaceId) return false;
  if (user.role === "admin" || user.role === "teacher" || user.role === "demo") return true;
  if (user.role !== "parent") return false;

  const link = await prisma.learningLink.findFirst({
    where: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      studentId: attachment.studentId,
      isActive: true,
      ...(attachment.learningLinkId ? { id: attachment.learningLinkId } : {}),
    },
    select: { id: true },
  });

  return Boolean(link);
}
