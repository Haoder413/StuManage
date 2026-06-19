import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const date = new Date(data.date);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const existing = await prisma.attendance.findFirst({
    where: {
      workspaceId: user.workspaceId,
      scheduleId: data.scheduleId,
      studentId: data.studentId,
      date: { gte: startOfDay, lt: endOfDay },
    },
  });

  const payload = {
      workspaceId: user.workspaceId,
      scheduleId: data.scheduleId,
      studentId: data.studentId,
      date,
      status: data.status,
      notes: data.notes || null,
      lessonContent: data.lessonContent || null,
      lessonFeedback: data.lessonFeedback || null,
      contentTags: JSON.stringify(data.contentTags || []),
      feedbackTags: JSON.stringify(data.feedbackTags || []),
      weakPointTags: JSON.stringify(data.weakPointTags || []),
  };

  const shouldUseLessonHour = data.status === "present" && existing?.status !== "present";
  const shouldRestoreLessonHour = existing?.status === "present" && data.status !== "present";

  const attendance = await prisma.$transaction(async (tx) => {
    const savedAttendance = existing
      ? await tx.attendance.update({ where: { id: existing.id }, data: payload })
      : await tx.attendance.create({ data: payload });

    if (shouldUseLessonHour) {
      await tx.student.updateMany({
        where: { id: data.studentId, workspaceId: user.workspaceId, remainingLessonHours: { gt: 0 } },
        data: { remainingLessonHours: { decrement: 1 } },
      });
    }

    if (shouldRestoreLessonHour) {
      await tx.student.update({
        where: { id: data.studentId },
        data: { remainingLessonHours: { increment: 1 } },
      });
    }

    return savedAttendance;
  });

  return NextResponse.json(attendance, { status: 201 });
}
