import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { ensureTeacherCanUseLearningLink, findLearningLinkForTeacherStudent } from "@/lib/learning-links";

function formatTeacherFeedback(data: {
  lessonFeedback?: string;
  feedbackTags?: string[];
  contentTags?: string[];
  weakPointTags?: string[];
}) {
  const parts = [
    data.lessonFeedback,
    Array.isArray(data.feedbackTags) && data.feedbackTags.length > 0 ? `反馈：${data.feedbackTags.join("、")}` : "",
    Array.isArray(data.contentTags) && data.contentTags.length > 0 ? `内容：${data.contentTags.join("、")}` : "",
    Array.isArray(data.weakPointTags) && data.weakPointTags.length > 0 ? `薄弱点：${data.weakPointTags.join("、")}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : null;
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const schedule = await prisma.schedule.findFirst({
    where: { id: String(data.scheduleId || ""), workspaceId: user.workspaceId },
    include: {
      course: {
        include: {
          studentCourses: { where: { status: "active" }, select: { studentId: true } },
        },
      },
    },
  });
  if (!schedule) return NextResponse.json({ error: "schedule not found" }, { status: 404 });

  const student = await prisma.student.findFirst({
    where: { id: data.studentId, workspaceId: user.workspaceId },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });

  if (schedule.studentId && schedule.studentId !== data.studentId) {
    return NextResponse.json({ error: "student does not match schedule" }, { status: 400 });
  }
  if (schedule.courseId && !schedule.course?.studentCourses.some((item) => item.studentId === data.studentId)) {
    return NextResponse.json({ error: "student is not in this course" }, { status: 400 });
  }

  const learningLink = data.learningLinkId
    ? user.role === "teacher"
      ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
      : await prisma.learningLink.findFirst({
          where: { id: String(data.learningLinkId), workspaceId: user.workspaceId, isActive: true },
          include: { parent: true, teacher: true, student: true, course: true },
        })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  if (data.learningLinkId && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (learningLink && learningLink.studentId !== String(data.studentId || "")) {
    return NextResponse.json({ error: "learning link student mismatch" }, { status: 400 });
  }
  if (learningLink?.courseId && schedule.courseId && learningLink.courseId !== schedule.courseId) {
    return NextResponse.json({ error: "learning link course mismatch" }, { status: 400 });
  }

  const date = new Date(data.date);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const existing = await prisma.attendance.findFirst({
    where: {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
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

  const isPresentAttendance = data.status === "present";
  const hasConsumedLessonHour = existing?.status === "present";
  const shouldUseLessonHour = isPresentAttendance && existing?.status !== "present";
  const shouldRestoreLessonHour = hasConsumedLessonHour && !isPresentAttendance;

  const attendance = await prisma.$transaction(async (tx) => {
    const savedAttendance = existing
      ? await tx.attendance.update({ where: { id: existing.id }, data: payload })
      : await tx.attendance.create({ data: payload });

    if (shouldUseLessonHour) {
      const beforeStudent = await tx.student.findFirst({
        where: { id: data.studentId, workspaceId: user.workspaceId },
        select: { totalLessonHours: true, remainingLessonHours: true },
      });
      await tx.student.updateMany({
        where: { id: data.studentId, workspaceId: user.workspaceId, remainingLessonHours: { gt: 0 } },
        data: { remainingLessonHours: { decrement: 1 } },
      });
      const afterStudent = await tx.student.findFirst({
        where: { id: data.studentId, workspaceId: user.workspaceId },
        select: { totalLessonHours: true, remainingLessonHours: true },
      });
      if (beforeStudent && afterStudent && beforeStudent.remainingLessonHours !== afterStudent.remainingLessonHours) {
        await tx.lessonHourLog.create({
          data: {
            workspaceId: user.workspaceId,
            studentId: data.studentId,
            attendanceId: savedAttendance.id,
            type: "attendance_present",
            deltaTotalHours: 0,
            deltaRemainingHours: afterStudent.remainingLessonHours - beforeStudent.remainingLessonHours,
            beforeTotalHours: beforeStudent.totalLessonHours,
            afterTotalHours: afterStudent.totalLessonHours,
            beforeRemainingHours: beforeStudent.remainingLessonHours,
            afterRemainingHours: afterStudent.remainingLessonHours,
            note: "出勤扣课时",
            teacherFeedback: formatTeacherFeedback(data),
          },
        });
      }
    }

    if (shouldRestoreLessonHour) {
      const beforeStudent = await tx.student.findFirstOrThrow({
        where: { id: data.studentId, workspaceId: user.workspaceId },
        select: { totalLessonHours: true, remainingLessonHours: true },
      });
      await tx.student.update({
        where: { id: data.studentId },
        data: { remainingLessonHours: { increment: 1 } },
      });
      const afterStudent = await tx.student.findFirstOrThrow({
        where: { id: data.studentId, workspaceId: user.workspaceId },
        select: { totalLessonHours: true, remainingLessonHours: true },
      });
      await tx.lessonHourLog.create({
        data: {
          workspaceId: user.workspaceId,
          studentId: data.studentId,
          attendanceId: savedAttendance.id,
          type: "attendance_restore",
          deltaTotalHours: 0,
          deltaRemainingHours: afterStudent.remainingLessonHours - beforeStudent.remainingLessonHours,
          beforeTotalHours: beforeStudent.totalLessonHours,
          afterTotalHours: afterStudent.totalLessonHours,
          beforeRemainingHours: beforeStudent.remainingLessonHours,
          afterRemainingHours: afterStudent.remainingLessonHours,
          note: "出勤改为非出勤，恢复课时",
          teacherFeedback: formatTeacherFeedback(data),
        },
      });
    }

    return savedAttendance;
  });

  return NextResponse.json(attendance, { status: 201 });
}
