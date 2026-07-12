import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayReviewDate } from "@/lib/review-scheduler";
import { requireTeacherLike } from "@/lib/auth";
import { ensureTeacherCanUseLearningLink, findLearningLinkForTeacherStudent } from "@/lib/learning-links";
import { visibleStudentByIdWhere, visibleStudentWhere } from "@/lib/teacher-visibility";

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

async function findHistoryWeakPointGroup(user: { workspaceId: string; id: string; role: string }, id: string) {
  const selected = await prisma.weakPoint.findFirst({
    where: {
      id,
      workspaceId: user.workspaceId,
      status: { not: "active" },
      student: visibleStudentWhere(user),
    },
    select: { id: true, studentId: true, description: true },
  });
  if (!selected) return null;

  const candidates = await prisma.weakPoint.findMany({
    where: {
      workspaceId: user.workspaceId,
      studentId: selected.studentId,
      status: { not: "active" },
      student: visibleStudentWhere(user),
    },
    select: { id: true, description: true },
  });
  const normalizedDescription = normalizeDescription(selected.description);
  return {
    selected,
    ids: candidates
      .filter((point) => normalizeDescription(point.description) === normalizedDescription)
      .map((point) => point.id),
  };
}

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const learningLinkId = searchParams.get("learningLinkId");
  const statusParam = searchParams.get("status");
  const statusFilter = statusParam === "history" ? { not: "active" } : "active";
  const where = studentId
    ? { workspaceId: user.workspaceId, studentId, student: visibleStudentWhere(user), ...(learningLinkId ? { learningLinkId } : {}), status: statusFilter }
    : { workspaceId: user.workspaceId, student: visibleStudentWhere(user), ...(learningLinkId ? { learningLinkId } : {}), status: statusFilter };
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
  const student = await prisma.student.findFirst({
    where: visibleStudentByIdWhere(user, String(data.studentId || "")),
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
  const learningLink = data.learningLinkId
    ? user.role === "teacher"
      ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
      : await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  const description = normalizeDescription(data.description);
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const existing = await prisma.weakPoint.findFirst({
    where: {
      workspaceId: user.workspaceId,
      studentId: data.studentId,
      student: visibleStudentWhere(user),
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
  if (data.manageHistory) {
    const description = normalizeDescription(data.description);
    const reviewCount = Number(data.reviewCount);
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
    if (!Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 999) {
      return NextResponse.json({ error: "invalid review count" }, { status: 400 });
    }
    const group = await findHistoryWeakPointGroup(user, String(data.id || ""));
    if (!group) return NextResponse.json({ error: "history weak point not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const duplicateIds = group.ids.filter((id) => id !== group.selected.id);
      if (duplicateIds.length > 0) {
        await tx.reviewSchedule.updateMany({
          where: { workspaceId: user.workspaceId, weakPointId: { in: duplicateIds } },
          data: { weakPointId: group.selected.id },
        });
        await tx.weakPoint.deleteMany({
          where: { workspaceId: user.workspaceId, id: { in: duplicateIds }, status: { not: "active" } },
        });
      }

      await tx.weakPoint.update({
        where: { id: group.selected.id },
        data: { description },
      });
      const schedules = await tx.reviewSchedule.findMany({
        where: { workspaceId: user.workspaceId, weakPointId: group.selected.id },
        select: { id: true, stage: true, status: true },
        orderBy: { createdAt: "desc" },
      });
      const completed = schedules.filter((schedule) => schedule.status === "completed");
      if (completed.length > reviewCount) {
        await tx.reviewSchedule.deleteMany({
          where: { id: { in: completed.slice(reviewCount).map((schedule) => schedule.id) } },
        });
      } else if (completed.length < reviewCount) {
        const maxStage = schedules.reduce((max, schedule) => Math.max(max, schedule.stage), 0);
        const now = new Date();
        await tx.reviewSchedule.createMany({
          data: Array.from({ length: reviewCount - completed.length }, (_, index) => ({
            workspaceId: user.workspaceId,
            weakPointId: group.selected.id,
            stage: maxStage + index + 1,
            nextReviewAt: now,
            status: "completed",
            lastReviewedAt: now,
          })),
        });
      }

      return tx.weakPoint.findUnique({
        where: { id: group.selected.id },
        include: { reviewSchedules: { orderBy: { createdAt: "asc" } } },
      });
    });
    return NextResponse.json(updated);
  }
  const weakPoint = await prisma.weakPoint.findFirst({
    where: { id: data.id, workspaceId: user.workspaceId, student: visibleStudentWhere(user) },
    select: { id: true },
  });
  if (!weakPoint) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (data.status === "mastered") {
    await prisma.weakPoint.updateMany({
      where: { id: weakPoint.id, workspaceId: user.workspaceId },
      data: { status: "mastered", masteredAt: new Date() },
    });

    await prisma.reviewSchedule.updateMany({
      where: { workspaceId: user.workspaceId, weakPointId: weakPoint.id, status: "pending" },
      data: { status: "completed", lastReviewedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (data.status === "active") {
    await prisma.weakPoint.updateMany({
      where: { id: weakPoint.id, workspaceId: user.workspaceId },
      data: { status: "active", masteredAt: null },
    });
    return NextResponse.json({ success: true });
  }

  if (data.reviewCompleted) {
    const schedule = await prisma.reviewSchedule.findFirst({
      where: { workspaceId: user.workspaceId, weakPointId: weakPoint.id, status: "pending" },
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
          weakPointId: weakPoint.id,
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

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const id = request.nextUrl.searchParams.get("id") || "";
  const group = await findHistoryWeakPointGroup(user, id);
  if (!group) return NextResponse.json({ error: "history weak point not found" }, { status: 404 });

  const result = await prisma.weakPoint.deleteMany({
    where: {
      workspaceId: user.workspaceId,
      id: { in: group.ids },
      status: { not: "active" },
    },
  });
  return NextResponse.json({ success: true, deletedCount: result.count });
}
