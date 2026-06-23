import { prisma } from "@/lib/prisma";

type CurrentUser = {
  id: string;
  workspaceId: string;
  role: string;
  teachingSubject?: string | null;
};

export function learningLinkInclude() {
  return {
    parent: { select: { id: true, name: true, role: true } },
    teacher: { select: { id: true, name: true, role: true, teachingSubject: true } },
    student: true,
    course: true,
  };
}

export async function getParentLearningLinks(user: CurrentUser) {
  return prisma.learningLink.findMany({
    where: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
    },
    include: learningLinkInclude(),
    orderBy: [{ student: { name: "asc" } }, { subject: "asc" }],
  });
}

export async function getTeacherLearningLinks(user: CurrentUser) {
  return prisma.learningLink.findMany({
    where: {
      workspaceId: user.workspaceId,
      teacherId: user.id,
      isActive: true,
    },
    include: learningLinkInclude(),
    orderBy: [{ student: { name: "asc" } }, { subject: "asc" }],
  });
}

export async function findLearningLinkForTeacherStudent(user: CurrentUser, studentId: string) {
  if (!studentId) return null;
  return prisma.learningLink.findFirst({
    where: {
      workspaceId: user.workspaceId,
      teacherId: user.id,
      studentId,
      isActive: true,
    },
    include: learningLinkInclude(),
    orderBy: { createdAt: "asc" },
  });
}

export async function findDefaultParentLearningLink(user: CurrentUser, studentId?: string | null) {
  return prisma.learningLink.findFirst({
    where: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
      ...(studentId ? { studentId } : {}),
    },
    include: learningLinkInclude(),
    orderBy: { createdAt: "asc" },
  });
}

export async function ensureParentCanUseLearningLink(user: CurrentUser, learningLinkId: string) {
  if (!learningLinkId) return null;
  return prisma.learningLink.findFirst({
    where: {
      id: learningLinkId,
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
    },
    include: learningLinkInclude(),
  });
}

export async function ensureTeacherCanUseLearningLink(user: CurrentUser, learningLinkId: string) {
  if (!learningLinkId) return null;
  return prisma.learningLink.findFirst({
    where: {
      id: learningLinkId,
      workspaceId: user.workspaceId,
      teacherId: user.id,
      isActive: true,
    },
    include: learningLinkInclude(),
  });
}

export function learningLinkLabel(link: {
  student?: { name: string } | null;
  teacher?: { name: string } | null;
  subject: string;
}) {
  return `${link.student?.name || "学生"} · ${link.subject} · ${link.teacher?.name || "老师"}`;
}
