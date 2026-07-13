import { Prisma } from "@prisma/client";
import { getTodayReviewDate } from "@/lib/review-scheduler";

export { normalizeWeakPointDescriptions } from "@/lib/weak-points";

export async function ensureWeakPointReview({
  tx,
  workspaceId,
  learningLinkId,
  studentId,
  description,
  knowledgePointId = null,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  learningLinkId: string | null;
  studentId: string;
  description: string;
  knowledgePointId?: string | null;
}) {
  const existing = await tx.weakPoint.findFirst({
    where: { workspaceId, studentId, description },
    include: {
      reviewSchedules: {
        where: { status: "pending" },
        orderBy: { nextReviewAt: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.status !== "active") {
      await tx.weakPoint.update({
        where: { id: existing.id },
        data: {
          status: "active",
          masteredAt: null,
          learningLinkId: existing.learningLinkId || learningLinkId,
        },
      });
    }

    if (!existing.reviewSchedules[0]) {
      await tx.reviewSchedule.create({
        data: {
          workspaceId,
          weakPointId: existing.id,
          stage: 1,
          nextReviewAt: getTodayReviewDate(),
          status: "pending",
        },
      });
    }
    return { id: existing.id, created: false };
  }

  const weakPoint = await tx.weakPoint.create({
    data: {
      workspaceId,
      learningLinkId,
      studentId,
      knowledgePointId,
      description,
      reviewSchedules: {
        create: {
          workspaceId,
          stage: 1,
          nextReviewAt: getTodayReviewDate(),
          status: "pending",
        },
      },
    },
  });
  return { id: weakPoint.id, created: true };
}

export async function applyExamWeakPoints({
  tx,
  workspaceId,
  learningLinkId,
  studentId,
  descriptions,
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  learningLinkId: string;
  studentId: string;
  descriptions: string[];
}) {
  for (const description of descriptions) {
    await ensureWeakPointReview({
      tx,
      workspaceId,
      learningLinkId,
      studentId,
      description,
    });
  }
}
