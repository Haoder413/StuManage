import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

async function validateScheduleRelations(workspaceId: string, data: { studentId?: string | null; courseId?: string | null }) {
  const studentId = data.studentId ? String(data.studentId) : null;
  const courseId = data.courseId ? String(data.courseId) : null;

  if (studentId) {
    const student = await prisma.student.findFirst({ where: { id: studentId, workspaceId }, select: { id: true } });
    if (!student) return "student not found";
  }

  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId }, select: { id: true } });
    if (!course) return "course not found";
  }

  if (studentId && courseId) {
    const studentCourse = await prisma.studentCourse.findFirst({
      where: { workspaceId, studentId, courseId, status: "active" },
      select: { id: true },
    });
    if (!studentCourse) return "student is not in this course";
  }

  return null;
}

export async function GET() {
  const user = await requireTeacherLike();
  const schedules = await prisma.schedule.findMany({
    where: { workspaceId: user.workspaceId, isActive: true },
    include: {
      student: true,
      course: {
        include: {
          studentCourses: {
            where: { status: "active" },
            include: { student: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      attendance: { include: { lessonVideo: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const relationError = await validateScheduleRelations(user.workspaceId, data);
  if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });

  const schedule = await prisma.schedule.create({
    data: {
      workspaceId: user.workspaceId,
      studentId: data.studentId || null,
      courseId: data.courseId || null,
      type: data.type,
      dayOfWeek: data.dayOfWeek ?? null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      date: data.date ? new Date(data.date) : null,
      notes: data.notes || null,
    },
    include: {
      student: true,
      course: {
        include: {
          studentCourses: {
            where: { status: "active" },
            include: { student: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      attendance: { include: { lessonVideo: true } },
    },
  });
  return NextResponse.json(schedule, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const relationError = await validateScheduleRelations(user.workspaceId, data);
  if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });

  await prisma.schedule.updateMany({
    where: { id: data.id, workspaceId: user.workspaceId },
    data: {
      studentId: data.studentId || null,
      courseId: data.courseId || null,
      type: data.type,
      dayOfWeek: data.dayOfWeek ?? null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      date: data.date ? new Date(data.date) : null,
      notes: data.notes || null,
    },
  });
  const schedule = await prisma.schedule.findFirst({
    where: { id: data.id, workspaceId: user.workspaceId },
    include: {
      student: true,
      course: {
        include: {
          studentCourses: {
            where: { status: "active" },
            include: { student: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      attendance: { include: { lessonVideo: true } },
    },
  });
  if (!schedule) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(schedule);
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.schedule.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  return NextResponse.json({ success: true });
}
