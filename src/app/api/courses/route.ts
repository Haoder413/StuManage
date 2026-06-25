import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

function normalizeScheduleTimes(data: unknown, workspaceId: string) {
  return Array.isArray(data)
    ? data
        .map((item: { dayOfWeek?: number; startTime?: string; endTime?: string }, index: number) => ({
          workspaceId,
          dayOfWeek: Number(item.dayOfWeek),
          startTime: String(item.startTime || ""),
          endTime: String(item.endTime || ""),
          orderIndex: index,
        }))
        .filter((item: { dayOfWeek: number; startTime: string; endTime: string }) =>
          Number.isInteger(item.dayOfWeek) && item.dayOfWeek >= 0 && item.dayOfWeek <= 6 && item.startTime && item.endTime
        )
    : [];
}

function normalizeStudentIds(data: unknown) {
  return Array.isArray(data)
    ? Array.from(new Set(
        data
          .filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id: string) => id.trim())
      ))
    : [];
}

async function syncCourseStudents(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  courseId: string,
  studentIds: string[]
) {
  const students = await tx.student.findMany({
    where: { workspaceId, id: { in: studentIds } },
    select: { id: true },
  });
  const validStudentIds = students.map((student) => student.id);

  await tx.studentCourse.updateMany({
    where: { workspaceId, courseId, status: "active", studentId: { notIn: validStudentIds } },
    data: { status: "inactive" },
  });

  for (const studentId of validStudentIds) {
    await tx.studentCourse.updateMany({
      where: { workspaceId, studentId, status: "active", courseId: { not: courseId } },
      data: { status: "inactive" },
    });

    const activeCourseLink = await tx.studentCourse.findFirst({
      where: { workspaceId, courseId, studentId, status: "active" },
      select: { id: true },
    });
    if (activeCourseLink) continue;

    const inactiveCourseLink = await tx.studentCourse.findFirst({
      where: { workspaceId, courseId, studentId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (inactiveCourseLink) {
      await tx.studentCourse.update({ where: { id: inactiveCourseLink.id }, data: { status: "active" } });
    } else {
      await tx.studentCourse.create({ data: { workspaceId, courseId, studentId, status: "active" } });
    }
  }

  return validStudentIds;
}

async function syncCourseSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  courseId: string,
  type: string,
  scheduleTimes: { dayOfWeek: number; startTime: string; endTime: string }[],
  studentIds: string[]
) {
  await tx.schedule.updateMany({
    where: { workspaceId, courseId, isActive: true },
    data: { isActive: false },
  });

  if (scheduleTimes.length === 0) return;

  if (type === "fixed") {
    await tx.schedule.createMany({
      data: scheduleTimes.map((time) => ({
        workspaceId,
        courseId,
        type: "fixed",
        dayOfWeek: time.dayOfWeek,
        startTime: time.startTime,
        endTime: time.endTime,
        isActive: true,
      })),
    });
    return;
  }

  if (studentIds.length > 0) {
    await tx.schedule.createMany({
      data: studentIds.flatMap((studentId) =>
        scheduleTimes.map((time) => ({
          workspaceId,
          studentId,
          courseId,
          type: "fixed",
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
          isActive: true,
        }))
      ),
    });
  }
}

export async function GET() {
  const user = await requireTeacherLike();
  const courses = await prisma.course.findMany({
    where: { workspaceId: user.workspaceId },
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      _count: { select: { knowledgePoints: true, studentCourses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const type = data.type === "custom" ? "custom" : "fixed";
  const scheduleTimes = normalizeScheduleTimes(data.scheduleTimes, user.workspaceId);
  const studentIds = normalizeStudentIds(data.studentIds);

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        workspaceId: user.workspaceId,
        name: data.name,
        description: data.description || null,
        type,
        defaultCapacity: type === "custom" ? 1 : data.defaultCapacity ? Number(data.defaultCapacity) : null,
        scheduleTimes: scheduleTimes.length > 0 ? { create: scheduleTimes } : undefined,
      },
      include: { scheduleTimes: { orderBy: { orderIndex: "asc" } } },
    });

    if (type === "fixed" && scheduleTimes.length > 0) {
      await tx.schedule.createMany({
        data: scheduleTimes.map((time: { dayOfWeek: number; startTime: string; endTime: string }) => ({
          workspaceId: user.workspaceId,
          courseId: created.id,
          type: "fixed",
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
          isActive: true,
        })),
      });
    }

    if (studentIds.length > 0) {
      const students = await tx.student.findMany({
        where: { workspaceId: user.workspaceId, id: { in: studentIds } },
        select: { id: true },
      });
      const validStudentIds = students.map((student) => student.id);

      if (validStudentIds.length > 0) {
        await tx.studentCourse.updateMany({
          where: { workspaceId: user.workspaceId, studentId: { in: validStudentIds }, status: "active" },
          data: { status: "inactive" },
        });
        await tx.schedule.updateMany({
          where: { workspaceId: user.workspaceId, studentId: { in: validStudentIds }, courseId: { not: null } },
          data: { isActive: false },
        });
        await tx.studentCourse.createMany({
          data: validStudentIds.map((studentId) => ({
            workspaceId: user.workspaceId,
            studentId,
            courseId: created.id,
            status: "active",
          })),
        });

        if (type === "custom" && scheduleTimes.length > 0) {
          await tx.schedule.createMany({
            data: validStudentIds.flatMap((studentId) =>
              scheduleTimes.map((time: { dayOfWeek: number; startTime: string; endTime: string }) => ({
                workspaceId: user.workspaceId,
                studentId,
                courseId: created.id,
                type: "fixed",
                dayOfWeek: time.dayOfWeek,
                startTime: time.startTime,
                endTime: time.endTime,
                isActive: true,
              }))
            ),
          });
        }
      }
    }

    return created;
  });
  return NextResponse.json(course, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id, workspaceId: user.workspaceId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.course.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const type = data.type === "custom" ? "custom" : "fixed";
  const scheduleTimes = normalizeScheduleTimes(data.scheduleTimes, user.workspaceId);
  const requestedStudentIds = normalizeStudentIds(data.studentIds);
  const selectedStudentIds = type === "custom" ? requestedStudentIds.slice(0, 1) : requestedStudentIds;

  const course = await prisma.$transaction(async (tx) => {
    const existing = await tx.course.findFirst({
      where: { id: data.id, workspaceId: user.workspaceId },
      select: { id: true },
    });
    if (!existing) return null;

    await tx.course.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description || null,
        type,
        defaultCapacity: type === "custom" ? 1 : data.defaultCapacity ? Number(data.defaultCapacity) : null,
      },
    });

    await tx.courseScheduleTime.deleteMany({ where: { workspaceId: user.workspaceId, courseId: existing.id } });
    if (scheduleTimes.length > 0) {
      await tx.courseScheduleTime.createMany({
        data: scheduleTimes.map((time) => ({ ...time, courseId: existing.id })),
      });
    }

    const validStudentIds = await syncCourseStudents(tx, user.workspaceId, existing.id, selectedStudentIds);
    await syncCourseSchedules(tx, user.workspaceId, existing.id, type, scheduleTimes, validStudentIds);

    return tx.course.findFirst({
      where: { id: existing.id, workspaceId: user.workspaceId },
      include: {
        scheduleTimes: { orderBy: { orderIndex: "asc" } },
        studentCourses: { where: { status: "active" }, include: { student: true } },
      },
    });
  });

  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(course);
}
