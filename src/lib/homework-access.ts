import { prisma } from "@/lib/prisma";

export function canManageHomework(user: { role: string }) {
  return ["admin", "teacher", "demo"].includes(user.role);
}

export function getHomeworkStatusLabel(status: string, dueAt?: Date | string | null) {
  if (status === "graded") return "已批改";
  if (status === "submitted") return "已提交";
  if (status === "pending" && dueAt && new Date(dueAt).getTime() < Date.now()) return "已逾期";
  return "待提交";
}

export async function findParentVisibleSubmission(params: {
  user: { id: string; workspaceId: string };
  submissionId: string;
}) {
  return prisma.homeworkSubmission.findFirst({
    where: {
      id: params.submissionId,
      workspaceId: params.user.workspaceId,
      student: {
        parentLinks: {
          some: { parentId: params.user.id },
        },
      },
      assignment: { status: "published" },
    },
    include: {
      assignment: { include: { course: true, questions: { orderBy: { orderIndex: "asc" } } } },
      student: true,
      currentVersion: { include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } } },
      versions: {
        include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } },
        orderBy: { versionNumber: "desc" },
      },
    },
  });
}
