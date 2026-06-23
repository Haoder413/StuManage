import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextReviewDate } from "@/lib/review-scheduler";
import { requireTeacherLike } from "@/lib/auth";
import { findLearningLinkForTeacherStudent } from "@/lib/learning-links";

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const learningLinkId = searchParams.get("learningLinkId");
  const statusParam = searchParams.get("status");
  const statusFilter = statusParam === "history" ? { not: "active" } : "active";
  const where = studentId
    ? { workspaceId: user.workspaceId, studentId, ...(learningLinkId ? { learningLinkId } : {}), status: statusFilter }
    : { workspaceId: user.workspaceId, ...(learningLinkId ? { learningLinkId } : {}), status: statusFilter };
  const weakPoints = await prisma.weakPoint.findMany({
    where,
    include: {
      reviewSchedules: { orderBy: { stage: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(weakPoints);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const learningLink = data.learningLinkId
    ? await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  const weakPoint = await prisma.weakPoint.create({
    data: {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
      studentId: data.studentId,
      knowledgePointId: data.knowledgePointId || null,
      description: data.description,
      reviewSchedules: {
        create: {
          workspaceId: user.workspaceId,
          stage: 1,
          nextReviewAt: getNextReviewDate(1),
          status: "pending",
        },
      },
    },
    include: {
      reviewSchedules: { orderBy: { stage: "asc" } },
    },
  });
  return NextResponse.json(weakPoint, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();

  if (data.status === "mastered") {
    await prisma.weakPoint.updateMany({
      where: { id: data.id, workspaceId: user.workspaceId },
      data: { status: "mastered", masteredAt: new Date() },
    });

    const schedule = await prisma.reviewSchedule.findFirst({
      where: { workspaceId: user.workspaceId, weakPointId: data.id, status: "pending" },
      orderBy: { stage: "asc" },
    });
    const nextStage = schedule ? schedule.stage + 1 : 1;

    if (schedule) {
      await prisma.reviewSchedule.update({
        where: { id: schedule.id },
        data: { status: "completed", lastReviewedAt: new Date() },
      });
    }

    if (nextStage <= 6) {
      await prisma.reviewSchedule.create({
        data: {
          workspaceId: user.workspaceId,
          weakPointId: data.id,
          stage: nextStage,
          nextReviewAt: getNextReviewDate(nextStage),
          status: "pending",
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  if (data.reviewCompleted) {
    const schedule = await prisma.reviewSchedule.findFirst({
      where: { workspaceId: user.workspaceId, weakPointId: data.id, status: "pending" },
      orderBy: { stage: "asc" },
    });
    if (schedule) {
      const nextStage = data.stillWeak ? 1 : schedule.stage + 1;
      await prisma.reviewSchedule.update({
        where: { id: schedule.id },
        data: { status: data.stillWeak ? "reset" : "completed", lastReviewedAt: new Date() },
      });
      if (nextStage <= 6) {
        await prisma.reviewSchedule.create({
          data: {
            workspaceId: user.workspaceId,
            weakPointId: data.id,
            stage: nextStage,
            nextReviewAt: getNextReviewDate(nextStage),
          },
        });
      }
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
