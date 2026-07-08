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

function reusableAttendanceScore(record: {
  learningLinkId: string | null;
  lessonVideo?: unknown | null;
  lessonAttachments?: unknown[] | null;
  lessonContent?: string | null;
  lessonFeedback?: string | null;
  contentTags?: string | null;
  feedbackTags?: string | null;
  weakPointTags?: string | null;
  createdAt: Date;
}) {
  return (
    (record.lessonVideo ? 100 : 0) +
    (record.lessonAttachments?.length ? 50 : 0) +
    (record.learningLinkId ? 20 : 0) +
    (record.lessonContent ? 10 : 0) +
    (record.lessonFeedback ? 10 : 0) +
    (record.contentTags ? 1 : 0) +
    (record.feedbackTags ? 1 : 0) +
    (record.weakPointTags ? 1 : 0) +
    record.createdAt.getTime() / 100000000000000
  );
}

function currentAttendanceLessonHourDelta(logs: { deltaRemainingHours: number }[] = []) {
  return logs.reduce((sum, log) => sum + log.deltaRemainingHours, 0);
}

function getRequestedLessonHourAmount(data: { status?: string; lessonHourAmount?: unknown }) {
  if (data.status !== "present") return 0;
  if (data.lessonHourAmount === undefined || data.lessonHourAmount === null || data.lessonHourAmount === "") return 1;
  const requestedLessonHourAmount = Number(data.lessonHourAmount);
  return Number.isInteger(requestedLessonHourAmount) && requestedLessonHourAmount > 0
    ? requestedLessonHourAmount
    : null;
}

async function findReusableAttendance(data: {
  workspaceId: string;
  learningLinkId: string | null;
  scheduleId: string;
  studentId: string;
  startOfDay: Date;
  endOfDay: Date;
}) {
  const records = await prisma.attendance.findMany({
    where: {
      workspaceId: data.workspaceId,
      scheduleId: data.scheduleId,
      studentId: data.studentId,
      date: { gte: data.startOfDay, lt: data.endOfDay },
      OR: data.learningLinkId
        ? [{ learningLinkId: data.learningLinkId }, { learningLinkId: null }]
        : [{ learningLinkId: null }],
    },
    include: { lessonVideo: true, lessonAttachments: true, lessonHourLogs: true },
  });

  return records.sort((a, b) => reusableAttendanceScore(b) - reusableAttendanceScore(a))[0] || null;
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

  const existing = await findReusableAttendance({
    workspaceId: user.workspaceId,
    learningLinkId: learningLink?.id || null,
    scheduleId: data.scheduleId,
    studentId: data.studentId,
    startOfDay,
    endOfDay,
  });

  const payload = {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
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
  const requestedLessonHourAmount = getRequestedLessonHourAmount(data);
  if (requestedLessonHourAmount === null) {
    return NextResponse.json({ error: "invalid lesson hour amount" }, { status: 400 });
  }
  const currentLessonHourDelta = currentAttendanceLessonHourDelta(existing?.lessonHourLogs || []);
  const desiredLessonHourDelta = isPresentAttendance ? -requestedLessonHourAmount : 0;
  const lessonHourAdjustment = desiredLessonHourDelta - currentLessonHourDelta;

  const attendance = await prisma.$transaction(async (tx) => {
    const beforeStudent = lessonHourAdjustment !== 0
      ? await tx.student.findFirstOrThrow({
          where: { id: data.studentId, workspaceId: user.workspaceId },
          select: { totalLessonHours: true, remainingLessonHours: true },
        })
      : null;

    if (beforeStudent && lessonHourAdjustment < 0) {
      const lessonHoursToConsume = Math.abs(lessonHourAdjustment);
      if (beforeStudent.remainingLessonHours < lessonHoursToConsume) return "insufficient_lesson_hours";
    }

    const savedAttendance = existing
      ? await tx.attendance.update({ where: { id: existing.id }, data: payload })
      : await tx.attendance.create({ data: payload });

    if (beforeStudent && lessonHourAdjustment !== 0) {
      if (lessonHourAdjustment < 0) {
        const lessonHoursToConsume = Math.abs(lessonHourAdjustment);
        const updated = await tx.student.updateMany({
          where: { id: data.studentId, workspaceId: user.workspaceId, remainingLessonHours: { gte: lessonHoursToConsume } },
          data: { remainingLessonHours: { decrement: lessonHoursToConsume } },
        });
        if (updated.count === 0) return "insufficient_lesson_hours";
      } else {
        await tx.student.update({
          where: { id: data.studentId },
          data: { remainingLessonHours: { increment: lessonHourAdjustment } },
        });
      }

      const afterStudent = await tx.student.findFirstOrThrow({
        where: { id: data.studentId, workspaceId: user.workspaceId },
        select: { totalLessonHours: true, remainingLessonHours: true },
      });
      await tx.lessonHourLog.create({
        data: {
          workspaceId: user.workspaceId,
          studentId: data.studentId,
          attendanceId: savedAttendance.id,
          type: lessonHourAdjustment < 0 ? "attendance_present" : "attendance_restore",
          deltaTotalHours: 0,
          deltaRemainingHours: lessonHourAdjustment,
          beforeTotalHours: beforeStudent.totalLessonHours,
          afterTotalHours: afterStudent.totalLessonHours,
          beforeRemainingHours: beforeStudent.remainingLessonHours,
          afterRemainingHours: afterStudent.remainingLessonHours,
          note: lessonHourAdjustment < 0 ? `出勤扣课时 ${Math.abs(lessonHourAdjustment)} 节` : `出勤课时调整退回 ${lessonHourAdjustment} 节`,
          teacherFeedback: formatTeacherFeedback(data),
        },
      });
    }

    return savedAttendance;
  });

  if (attendance === "insufficient_lesson_hours") {
    return NextResponse.json({ error: "insufficient lesson hours" }, { status: 400 });
  }

  const attendanceWithRelations = await prisma.attendance.findFirst({
    where: { id: attendance.id, workspaceId: user.workspaceId },
    include: { lessonVideo: true, lessonAttachments: true, lessonHourLogs: true },
  });

  return NextResponse.json(attendanceWithRelations || attendance, { status: 201 });
}
