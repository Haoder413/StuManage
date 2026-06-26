import { prisma } from "@/lib/prisma";
import { getParentLearningLinks } from "@/lib/learning-links";

export async function getParentStudents(user: { id: string; workspaceId: string }) {
  return prisma.parentStudent.findMany({
    where: {
      parentId: user.id,
      student: { workspaceId: user.workspaceId },
    },
    include: {
      student: {
        include: {
          studentCourses: { where: { status: "active" }, include: { course: true } },
          attendance: {
            orderBy: { date: "desc" },
            include: { schedule: true },
          },
          exams: { orderBy: { date: "desc" } },
          schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
          kpProgress: {
            include: { knowledgePoint: true },
            orderBy: { knowledgePoint: { orderIndex: "asc" } },
          },
          weakPoints: {
            include: { reviewSchedules: { orderBy: { stage: "asc" } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
}

export async function getParentLearningData(
  user: { id: string; workspaceId: string; role: string },
  selectedLinkId?: string
) {
  const learningLinks = await getParentLearningLinks(user);
  const selectedLink = learningLinks.find((link) => link.id === selectedLinkId) || learningLinks[0] || null;
  const activeSelectedLinkId = selectedLink?.id || "";

  const parentStudents = selectedLink
    ? await prisma.parentStudent.findMany({
        where: {
          parentId: user.id,
          studentId: selectedLink.studentId,
          student: { workspaceId: user.workspaceId },
        },
        include: {
          student: {
            include: {
              studentCourses: { where: { status: "active" }, include: { course: true } },
              attendance: {
                where: { learningLinkId: activeSelectedLinkId },
                orderBy: { date: "desc" },
                include: { schedule: true, learningLink: { include: { teacher: true } } },
              },
              exams: {
                where: { learningLinkId: activeSelectedLinkId },
                orderBy: { date: "desc" },
                include: { learningLink: { include: { teacher: true } } },
              },
              schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
              kpProgress: {
                where: { learningLinkId: activeSelectedLinkId },
                include: { knowledgePoint: true, learningLink: { include: { teacher: true } } },
                orderBy: { knowledgePoint: { orderIndex: "asc" } },
              },
              weakPoints: {
                where: { learningLinkId: activeSelectedLinkId },
                include: { reviewSchedules: { orderBy: { stage: "asc" } }, learningLink: { include: { teacher: true } } },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      })
    : [];

  return {
    learningLinks,
    selectedLink,
    selectedLinkId: activeSelectedLinkId,
    parentStudents,
    teacher: selectedLink?.teacher || null,
    subject: selectedLink?.subject || "",
  };
}

export function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}
