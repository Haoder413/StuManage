import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayReviewDate } from "@/lib/review-scheduler";
import { requireTeacherLike } from "@/lib/auth";
import { findLearningLinkForTeacherStudent } from "@/lib/learning-links";

function normalizeDescription(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function dedupeWeakPointsForResponse<T extends { description: string; reviewSchedules: any[]; createdAt: Date }>(weakPoints: T[]) {
  const byDescription = new Map<string, T>();
  for (const weakPoint of weakPoints) {
    const key = normalizeDescription(weakPoint.description);
    const existing = byDescription.get(key);
    if (!existing) {
      byDescription.set(key, weakPoint);
      continue;
    }
    existing.reviewSchedules = [...existing.reviewSchedules, ...weakPoint.reviewSchedules]
      .sort((a, b) => new Date(b.lastReviewedAt || b.createdAt).getTime() - new Date(a.lastReviewedAt || a.createdAt).getTime());
  }
  return [...byDescription.values()];
}

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
  return NextResponse.json(dedupeWeakPointsForResponse(weakPoints));
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const learningLink = data.learningLinkId
    ? await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  const description = normalizeDescription(data.description);
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const existing = await prisma.weakPoint.findFirst({
    where: {
      workspaceId: user.workspaceId,
      studentId: data.studentId,
      description,
    },
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
      await prisma.weakPoint.update({
        where: { id: existing.id },
        data: { status: "active", masteredAt: null, learningLinkId: existing.learningLinkId || learningLink?.id || null },
      });
    }
    if (!existing.reviewSchedules[0]) {
      await prisma.reviewSchedule.create({
        data: {
          workspaceId: user.workspaceId,
          weakPointId: existing.id,
          stage: 1,
          nextReviewAt: getTodayReviewDate(),
          status: "pending",
        },
      });
    }
    const weakPoint = await prisma.weakPoint.findUnique({
      where: { id: existing.id },
      include: { reviewSchedules: { orderBy: { nextReviewAt: "asc" } } },
    });
    return NextResponse.json(weakPoint, { status: 200 });
  }

  const weakPoint = await prisma.weakPoint.create({
    data: {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
      studentId: data.studentId,
      knowledgePointId: data.knowledgePointId || null,
      description,
      reviewSchedules: {
        create: {
          workspaceId: user.workspaceId,
          stage: 1,
          nextReviewAt: getTodayReviewDate(),
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

    await prisma.reviewSchedule.updateMany({
      where: { workspaceId: user.workspaceId, weakPointId: data.id, status: "pending" },
      data: { status: "completed", lastReviewedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (data.status === "active") {
    await prisma.weakPoint.updateMany({
      where: { id: data.id, workspaceId: user.workspaceId },
      data: { status: "active", masteredAt: null },
    });
    return NextResponse.json({ success: true });
  }

  if (data.reviewCompleted) {
    const schedule = await prisma.reviewSchedule.findFirst({
      where: { workspaceId: user.workspaceId, weakPointId: data.id, status: "pending" },
      orderBy: { nextReviewAt: "asc" },
    });
    if (schedule) {
      await prisma.reviewSchedule.update({
        where: { id: schedule.id },
        data: { status: "completed", lastReviewedAt: new Date() },
      });
    } else {
      await prisma.reviewSchedule.create({
        data: {
          workspaceId: user.workspaceId,
          weakPointId: data.id,
          stage: 1,
          nextReviewAt: getTodayReviewDate(),
          status: "completed",
          lastReviewedAt: new Date(),
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
