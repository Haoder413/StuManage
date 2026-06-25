import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

const LESSON_HOUR_ACTIONS = ["add", "use"] as const;

async function syncStudentCourseAndSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  studentId: string,
  courseId: string | null | undefined
) {
  const currentActiveCourse = await tx.studentCourse.findFirst({
    where: { workspaceId, studentId, status: "active" },
    select: { courseId: true },
    orderBy: { createdAt: "desc" },
  });

  if (currentActiveCourse?.courseId === courseId) return;

  await tx.studentCourse.updateMany({
    where: { workspaceId, studentId, status: "active" },
    data: { status: "inactive" },
  });

  await tx.schedule.deleteMany({
    where: { workspaceId, studentId, courseId: { not: null } },
  });

  if (!courseId) return;

  const course = await tx.course.findFirst({
    where: { id: courseId, workspaceId },
    include: { scheduleTimes: { orderBy: { orderIndex: "asc" } } },
  });
  if (!course) return;

  await tx.studentCourse.create({
    data: {
      workspaceId,
      studentId,
      courseId,
      status: "active",
    },
  });

  if (course.type === "custom" && course.scheduleTimes.length > 0) {
    await tx.schedule.createMany({
      data: course.scheduleTimes.map((time) => ({
        workspaceId,
        studentId,
        courseId: course.id,
        type: "fixed",
        dayOfWeek: time.dayOfWeek,
        startTime: time.startTime,
        endTime: time.endTime,
      })),
    });
  }
}

export async function GET() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    include: {
      studentCourses: { include: { course: true } },
      schedules: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(students);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const hasCourse = Boolean(data.courseId);
  const legacyHasSchedule = hasCourse && data.dayOfWeek !== undefined && data.startTime && data.endTime;
  const totalLessonHours = data.totalLessonHours ? parseInt(data.totalLessonHours) || 0 : 0;
  const remainingLessonHours = data.remainingLessonHours !== undefined
    ? parseInt(data.remainingLessonHours) || 0
    : totalLessonHours;
  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        workspaceId: user.workspaceId,
        name: data.name,
        grade: data.grade || null,
        parentContact: data.parentContact || null,
        enrollmentDate: new Date(data.enrollmentDate),
        lessonFrequency: data.lessonFrequency || null,
        tuition: data.tuition ? parseFloat(data.tuition) : null,
        totalLessonHours,
        remainingLessonHours,
        notes: data.notes || null,
      },
    });

    if (hasCourse) {
      await syncStudentCourseAndSchedules(tx, user.workspaceId, created.id, data.courseId);
      const schedules = await tx.schedule.findMany({ where: { workspaceId: user.workspaceId, studentId: created.id } });
      if (schedules.length === 0 && legacyHasSchedule) {
        await tx.schedule.create({
          data: {
            workspaceId: user.workspaceId,
            studentId: created.id,
            courseId: data.courseId,
            type: "fixed",
            dayOfWeek: Number(data.dayOfWeek),
            startTime: data.startTime,
            endTime: data.endTime,
          },
        });
      }
    }

    return tx.student.findFirstOrThrow({
      where: { id: created.id, workspaceId: user.workspaceId },
      include: {
        studentCourses: { include: { course: true } },
        schedules: true,
      },
    });
  });
  return NextResponse.json(student, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const student = await prisma.$transaction(async (tx) => {
    await tx.student.updateMany({
      where: { id: data.id, workspaceId: user.workspaceId },
      data: {
        name: data.name,
        grade: data.grade || null,
        parentContact: data.parentContact || null,
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : undefined,
        lessonFrequency: data.lessonFrequency || null,
        tuition: data.tuition ? parseFloat(data.tuition) : null,
        totalLessonHours: data.totalLessonHours !== undefined ? parseInt(data.totalLessonHours) || 0 : undefined,
        remainingLessonHours: data.remainingLessonHours !== undefined ? parseInt(data.remainingLessonHours) || 0 : undefined,
        notes: data.notes || null,
      },
    });

    if ("courseId" in data) {
      await syncStudentCourseAndSchedules(
        tx,
        user.workspaceId,
        data.id,
        data.courseId === "none" ? null : data.courseId
      );
    }

    return tx.student.findFirst({
      where: { id: data.id, workspaceId: user.workspaceId },
      include: {
        studentCourses: { where: { status: "active" }, include: { course: true } },
        schedules: true,
      },
    });
  });

  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PUT(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const action = String(data.action || "");
  const amount = Number(data.amount);
  const note = String(data.note || "").trim() || null;

  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (!LESSON_HOUR_ACTIONS.includes(action as (typeof LESSON_HOUR_ACTIONS)[number])) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const student = await prisma.$transaction(async (tx) => {
    const beforeStudent = await tx.student.findFirst({
      where: { id: data.id, workspaceId: user.workspaceId },
      select: { id: true, totalLessonHours: true, remainingLessonHours: true },
    });
    if (!beforeStudent) return null;
    if (action === "use" && amount > beforeStudent.remainingLessonHours) {
      return "insufficient_lesson_hours";
    }

    const updateData = action === "add"
      ? {
          totalLessonHours: { increment: amount },
          remainingLessonHours: { increment: amount },
        }
      : {
          remainingLessonHours: { decrement: amount },
        };

    await tx.student.update({ where: { id: beforeStudent.id }, data: updateData });
    const afterStudent = await tx.student.findFirstOrThrow({
      where: { id: beforeStudent.id, workspaceId: user.workspaceId },
      include: {
        studentCourses: { where: { status: "active" }, include: { course: true } },
        schedules: true,
      },
    });

    await tx.lessonHourLog.create({
      data: {
        workspaceId: user.workspaceId,
        studentId: beforeStudent.id,
        type: action === "add" ? "manual_add" : "manual_use",
        deltaTotalHours: afterStudent.totalLessonHours - beforeStudent.totalLessonHours,
        deltaRemainingHours: afterStudent.remainingLessonHours - beforeStudent.remainingLessonHours,
        beforeTotalHours: beforeStudent.totalLessonHours,
        afterTotalHours: afterStudent.totalLessonHours,
        beforeRemainingHours: beforeStudent.remainingLessonHours,
        afterRemainingHours: afterStudent.remainingLessonHours,
        note,
        teacherFeedback: null,
      },
    });

    return afterStudent;
  });

  if (student === "insufficient_lesson_hours") {
    return NextResponse.json({ error: "insufficient lesson hours" }, { status: 400 });
  }
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(student);
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const result = await prisma.student.deleteMany({
    where: { id, workspaceId: user.workspaceId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
