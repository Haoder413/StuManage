import { prisma } from "@/lib/prisma";

export async function getParentStudents(user: { id: string; workspaceId: string }) {
  return prisma.parentStudent.findMany({
    where: {
      parentId: user.id,
      student: { workspaceId: user.workspaceId },
    },
    include: {
      student: {
        include: {
          studentCourses: { include: { course: true } },
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

export function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}
