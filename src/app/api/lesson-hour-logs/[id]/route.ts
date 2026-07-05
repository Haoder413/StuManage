import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function parseInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  const data = await request.json();
  const deltaTotalHours = parseInteger(data.deltaTotalHours);
  const deltaRemainingHours = parseInteger(data.deltaRemainingHours);
  const type = String(data.type || "").trim();

  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });
  if (deltaTotalHours === null || deltaRemainingHours === null) {
    return NextResponse.json({ error: "invalid delta" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.lessonHourLog.findFirst({
      where: { id: params.id, workspaceId: user.workspaceId },
      include: { student: { select: { id: true, totalLessonHours: true, remainingLessonHours: true } } },
    });
    if (!log) return null;

    const totalAdjustment = deltaTotalHours - log.deltaTotalHours;
    const remainingAdjustment = deltaRemainingHours - log.deltaRemainingHours;
    const nextTotalLessonHours = log.student.totalLessonHours + totalAdjustment;
    const nextRemainingLessonHours = log.student.remainingLessonHours + remainingAdjustment;

    if (nextTotalLessonHours < 0 || nextRemainingLessonHours < 0) return "negative_lesson_hours";

    await tx.student.update({
      where: { id: log.studentId },
      data: {
        totalLessonHours: { increment: totalAdjustment },
        remainingLessonHours: { increment: remainingAdjustment },
      },
    });

    return tx.lessonHourLog.update({
      where: { id: log.id },
      data: {
        type,
        deltaTotalHours,
        deltaRemainingHours,
        afterTotalHours: log.beforeTotalHours + deltaTotalHours,
        afterRemainingHours: log.beforeRemainingHours + deltaRemainingHours,
        note: String(data.note || "").trim() || null,
        teacherFeedback: String(data.teacherFeedback || "").trim() || null,
        createdAt: parseOptionalDate(data.occurredAt) || log.createdAt,
      },
    });
  });

  if (result === "negative_lesson_hours") {
    return NextResponse.json({ error: "negative lesson hours" }, { status: 400 });
  }
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin();

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.lessonHourLog.findFirst({
      where: { id: params.id, workspaceId: user.workspaceId },
      include: { student: { select: { id: true, totalLessonHours: true, remainingLessonHours: true } } },
    });
    if (!log) return null;

    const totalAdjustment = -log.deltaTotalHours;
    const remainingAdjustment = -log.deltaRemainingHours;
    const nextTotalLessonHours = log.student.totalLessonHours + totalAdjustment;
    const nextRemainingLessonHours = log.student.remainingLessonHours + remainingAdjustment;

    if (nextTotalLessonHours < 0 || nextRemainingLessonHours < 0) return "negative_lesson_hours";

    await tx.student.update({
      where: { id: log.studentId },
      data: {
        totalLessonHours: { increment: totalAdjustment },
        remainingLessonHours: { increment: remainingAdjustment },
      },
    });
    await tx.lessonHourLog.delete({ where: { id: log.id } });
    return { ok: true };
  });

  if (result === "negative_lesson_hours") {
    return NextResponse.json({ error: "negative lesson hours" }, { status: 400 });
  }
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}
