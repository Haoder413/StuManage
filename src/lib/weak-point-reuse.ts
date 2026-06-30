import { Prisma } from "@prisma/client";
import { getNextReviewDate } from "@/lib/review-scheduler";

export function normalizeWeakPointDescriptions(values: unknown) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const descriptions: string[] = [];
  for (const value of values) {
    const description = String(value || "").trim();
    if (!description || seen.has(description)) continue;
    seen.add(description);
    descriptions.push(description);
  }
  return descriptions;
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
    const existing = await tx.weakPoint.findFirst({
      where: {
        workspaceId,
        learningLinkId,
        studentId,
        description,
        OR: [
          { status: "active" },
          { reviewSchedules: { some: { status: "pending" } } },
        ],
      },
      include: {
        reviewSchedules: {
          where: { status: "pending" },
          orderBy: { stage: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingSchedule = existing?.reviewSchedules[0];
    if (pendingSchedule) continue;

    if (existing) {
      await tx.reviewSchedule.create({
        data: {
          workspaceId,
          weakPointId: existing.id,
          stage: 1,
          nextReviewAt: getNextReviewDate(1),
          status: "pending",
        },
      });
      continue;
    }

    const weakPoint = await tx.weakPoint.create({
      data: {
        workspaceId,
        learningLinkId,
        studentId,
        description,
      },
    });

    await tx.reviewSchedule.create({
      data: {
        workspaceId,
        weakPointId: weakPoint.id,
        stage: 1,
        nextReviewAt: getNextReviewDate(1),
        status: "pending",
      },
    });
  }
}
