import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

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
  const hasSchedule = hasCourse && data.dayOfWeek !== undefined && data.startTime && data.endTime;
  const totalLessonHours = data.totalLessonHours ? parseInt(data.totalLessonHours) || 0 : 0;
  const remainingLessonHours = data.remainingLessonHours !== undefined
    ? parseInt(data.remainingLessonHours) || 0
    : totalLessonHours;
  const student = await prisma.student.create({
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
      studentCourses: hasCourse ? {
        create: {
          workspaceId: user.workspaceId,
          courseId: data.courseId,
          status: "active",
        },
      } : undefined,
      schedules: hasSchedule ? {
        create: {
          workspaceId: user.workspaceId,
          type: "fixed",
          dayOfWeek: Number(data.dayOfWeek),
          startTime: data.startTime,
          endTime: data.endTime,
        },
      } : undefined,
    },
    include: {
      studentCourses: { include: { course: true } },
      schedules: true,
    },
  });
  return NextResponse.json(student, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await prisma.student.updateMany({
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
  const student = await prisma.student.findFirst({
    where: { id: data.id, workspaceId: user.workspaceId },
    include: {
      studentCourses: { include: { course: true } },
      schedules: true,
    },
  });
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(student);
}
