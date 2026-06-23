import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { getNextReviewDate } from "@/lib/review-scheduler";

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  if (user.role !== "teacher" && user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data = await request.json();
  const examId = String(data.examId || "");
  const action = String(data.action || "");
  const weakPointDescriptions: string[] = Array.isArray(data.weakPointDescriptions)
    ? data.weakPointDescriptions.map(String).map((item: string) => item.trim()).filter(Boolean)
    : [];

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      workspaceId: user.workspaceId,
      reviewStatus: "pending_review",
      ...(user.role === "teacher" ? { learningLink: { teacherId: user.id } } : {}),
    },
    include: { learningLink: true },
  });

  if (!exam) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "reject") {
    const rejected = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        reviewStatus: "rejected",
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: String(data.rejectionReason || "老师已驳回该成绩").trim(),
      },
    });
    return NextResponse.json(rejected);
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const approved = await prisma.$transaction(async (tx) => {
    const savedExam = await tx.exam.update({
      where: { id: exam.id },
      data: {
        reviewStatus: "approved",
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (exam.learningLink && weakPointDescriptions.length > 0) {
      for (const description of weakPointDescriptions) {
        const weakPoint = await tx.weakPoint.create({
          data: {
            workspaceId: user.workspaceId,
            learningLinkId: exam.learningLink.id,
            studentId: exam.learningLink.studentId,
            description,
          },
        });
        await tx.reviewSchedule.create({
          data: {
            workspaceId: user.workspaceId,
            weakPointId: weakPoint.id,
            stage: 1,
            nextReviewAt: getNextReviewDate(1),
            status: "pending",
          },
        });
      }
    }

    return savedExam;
  });

  return NextResponse.json(approved);
}
