import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

async function syncStudentCourseAndSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  studentId: string,
  courseId: string | null | undefined
) {
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
