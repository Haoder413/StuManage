import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayReviewDate } from "@/lib/review-scheduler";
import { requireTeacherLike } from "@/lib/auth";
import { ensureTeacherCanUseLearningLink, findLearningLinkForTeacherStudent } from "@/lib/learning-links";
import {
  teacherSubjectMatches,
  type TeacherVisibilityUser,
  visibleProgressStudentByIdWhere,
  visibleProgressWeakPointWhere,
} from "@/lib/teacher-visibility";
import { dedupeWeakPoints, normalizeWeakPointDescription } from "@/lib/weak-points";
import { ensureWeakPointReview } from "@/lib/weak-point-reuse";

async function findWeakPointGroup(user: TeacherVisibilityUser, id: string) {
  const selected = await prisma.weakPoint.findFirst({
    where: {
      id,
      ...visibleProgressWeakPointWhere(user),
    },
    select: { id: true, studentId: true, description: true, status: true },
  });
  if (!selected) return null;

  const statusFilter = selected.status === "active" ? "active" : { not: "active" };
  const candidates = await prisma.weakPoint.findMany({
    where: {
      ...visibleProgressWeakPointWhere(user),
      studentId: selected.studentId,
      status: statusFilter,
    },
    select: { id: true, description: true },
  });
  const normalizedDescription = normalizeWeakPointDescription(selected.description);
  return {
    selected,
    statusFilter,
    candidates,
    ids: candidates
      .filter((point) => normalizeWeakPointDescription(point.description) === normalizedDescription)
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
  const where = {
    ...visibleProgressWeakPointWhere(user),
    ...(studentId ? { studentId } : {}),
    ...(learningLinkId ? { learningLinkId } : {}),
    status: statusFilter,
  };
  const weakPoints = await prisma.weakPoint.findMany({
    where,
    include: {
      reviewSchedules: { orderBy: { stage: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(dedupeWeakPoints(weakPoints));
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const student = await prisma.student.findFirst({
    where: visibleProgressStudentByIdWhere(user, String(data.studentId || "")),
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
  const learningLink = data.learningLinkId
    ? user.role === "teacher"
      ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
      : await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(
        user,
        String(data.studentId || ""),
        undefined,
        user.role === "teacher" ? user.teachingSubject : null,
      );
  if (data.learningLinkId && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (learningLink && learningLink.studentId !== student.id) {
    return NextResponse.json({ error: "learning link student mismatch" }, { status: 400 });
  }
  if (learningLink && !teacherSubjectMatches(user, learningLink.subject)) {
    return NextResponse.json({ error: "learning link subject mismatch" }, { status: 400 });
  }
  const description = normalizeWeakPointDescription(data.description);
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });

  const weakPoint = await prisma.$transaction(async (tx) => {
    const result = await ensureWeakPointReview({
      tx,
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
      studentId: student.id,
      knowledgePointId: data.knowledgePointId || null,
      description,
    });
    const record = await tx.weakPoint.findUnique({
      where: { id: result.id },
      include: { reviewSchedules: { orderBy: { nextReviewAt: "asc" } } },
    });
    return { record, created: result.created };
  });
  return NextResponse.json(weakPoint.record, { status: weakPoint.created ? 201 : 200 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (data.manageWeakPoint || data.manageHistory) {
    const description = normalizeWeakPointDescription(data.description);
    const reviewCount = Number(data.reviewCount);
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
    if (!Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 999) {
      return NextResponse.json({ error: "invalid review count" }, { status: 400 });
    }
    const group = await findWeakPointGroup(user, String(data.id || ""));
    if (!group) return NextResponse.json({ error: "weak point not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const targetDuplicateIds = group.candidates
        .filter((point) => normalizeWeakPointDescription(point.description) === description)
        .map((point) => point.id);
      const duplicateIds = [...new Set([...group.ids, ...targetDuplicateIds])]
        .filter((id) => id !== group.selected.id);
      if (duplicateIds.length > 0) {
        await tx.reviewSchedule.updateMany({
          where: { workspaceId: user.workspaceId, weakPointId: { in: duplicateIds } },
          data: { weakPointId: group.selected.id },
        });
        await tx.weakPoint.deleteMany({
          where: { workspaceId: user.workspaceId, id: { in: duplicateIds }, status: group.statusFilter },
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
    where: { id: data.id, ...visibleProgressWeakPointWhere(user) },
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
  const group = await findWeakPointGroup(user, id);
  if (!group) return NextResponse.json({ error: "weak point not found" }, { status: 404 });

  const result = await prisma.weakPoint.deleteMany({
    where: {
      workspaceId: user.workspaceId,
      id: { in: group.ids },
      status: group.statusFilter,
    },
  });
  return NextResponse.json({ success: true, deletedCount: result.count });
}
