import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import {
  deletableCourseByIdWhere,
  visibleCourseByIdWhere,
  visibleCourseWhere,
  visibleStudentWhere,
  type TeacherVisibilityUser,
} from "@/lib/teacher-visibility";

type NormalizedScheduleTime = {
  workspaceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: Date | null;
  endDate: Date | null;
  orderIndex: number;
};

type DesiredSchedule = {
  workspaceId: string;
  studentId?: string | null;
  courseId: string;
  type: "fixed";
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
};

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeScheduleTimes(data: unknown, workspaceId: string) {
  if (!Array.isArray(data)) return [];

  const normalized: NormalizedScheduleTime[] = [];
  data.forEach((item: { dayOfWeek?: number; dayOfWeeks?: number[]; startTime?: string; endTime?: string; startDate?: string; endDate?: string }, index: number) => {
    const dayOfWeeks = Array.isArray(item.dayOfWeeks) ? item.dayOfWeeks : [item.dayOfWeek];
    const startDate = parseOptionalDate(item.startDate);
    const endDate = parseOptionalDate(item.endDate);
    if (startDate && endDate && endDate < startDate) return;

    Array.from(new Set(dayOfWeeks.map(Number))).forEach((dayOfWeek) => {
      normalized.push({
          workspaceId,
          dayOfWeek,
          startTime: String(item.startTime || ""),
          endTime: String(item.endTime || ""),
          startDate,
          endDate,
          orderIndex: normalized.length + index,
      });
    });
  });

  return normalized.filter((item) =>
    Number.isInteger(item.dayOfWeek) && item.dayOfWeek >= 0 && item.dayOfWeek <= 6 && item.startTime && item.endTime
  );
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

function scheduleDateKey(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function scheduleMatchKey(schedule: {
  studentId?: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  startDate: Date | null;
  endDate: Date | null;
}) {
  return [
    schedule.studentId || "",
    schedule.dayOfWeek ?? "",
    schedule.startTime || "",
    schedule.endTime || "",
    scheduleDateKey(schedule.startDate),
    scheduleDateKey(schedule.endDate),
  ].join("|");
}

function buildDesiredSchedules(
  workspaceId: string,
  courseId: string,
  type: string,
  scheduleTimes: NormalizedScheduleTime[],
  studentIds: string[]
) {
  if (type === "fixed") {
    return scheduleTimes.map((time) => ({
      workspaceId,
      courseId,
      type: "fixed" as const,
      dayOfWeek: time.dayOfWeek,
      startTime: time.startTime,
      endTime: time.endTime,
      startDate: time.startDate,
      endDate: time.endDate,
      isActive: true,
    }));
  }

  return studentIds.flatMap((studentId) =>
    scheduleTimes.map((time) => ({
      workspaceId,
      studentId,
      courseId,
      type: "fixed" as const,
      dayOfWeek: time.dayOfWeek,
      startTime: time.startTime,
      endTime: time.endTime,
      startDate: time.startDate,
      endDate: time.endDate,
      isActive: true,
    }))
  );
}

function removeMatchedDesiredSchedule(desiredSchedules: DesiredSchedule[], existingSchedule: {
  studentId?: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  startDate: Date | null;
  endDate: Date | null;
}) {
  const key = scheduleMatchKey(existingSchedule);
  const index = desiredSchedules.findIndex((schedule) => scheduleMatchKey(schedule) === key);
  if (index === -1) return false;
  desiredSchedules.splice(index, 1);
  return true;
}

async function deleteSchedulesWithoutAttendance(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  courseId: string
) {
  await tx.schedule.deleteMany({
    where: { workspaceId, courseId, attendance: { none: {} } },
  });
}

async function preserveAttendedSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  courseId: string,
  desiredSchedules: DesiredSchedule[]
) {
  const attendedSchedules = await tx.schedule.findMany({
    where: { workspaceId, courseId, attendance: { some: {} } },
    select: {
      id: true,
      studentId: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      startDate: true,
      endDate: true,
    },
  });

  for (const schedule of attendedSchedules) {
    const stillMatchesCourseTime = removeMatchedDesiredSchedule(desiredSchedules, schedule);
    await tx.schedule.update({
      where: { id: schedule.id },
      data: { isActive: stillMatchesCourseTime },
    });
  }
}

async function syncCourseStudents(
  tx: Prisma.TransactionClient,
  user: TeacherVisibilityUser,
  courseId: string,
  studentIds: string[]
) {
  const students = await tx.student.findMany({
    where: { ...visibleStudentWhere(user), id: { in: studentIds } },
    select: { id: true },
  });
  const validStudentIds = students.map((student) => student.id);

  await tx.studentCourse.updateMany({
    where: { workspaceId: user.workspaceId, courseId, status: "active", studentId: { notIn: validStudentIds } },
    data: { status: "inactive" },
  });

  for (const studentId of validStudentIds) {
    const activeCourseLink = await tx.studentCourse.findFirst({
      where: { workspaceId: user.workspaceId, courseId, studentId, status: "active" },
      select: { id: true },
    });
    if (activeCourseLink) continue;

    const inactiveCourseLink = await tx.studentCourse.findFirst({
      where: { workspaceId: user.workspaceId, courseId, studentId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (inactiveCourseLink) {
      await tx.studentCourse.update({
        where: { id: inactiveCourseLink.id },
        data: { status: "active", endDate: null, endEvaluation: null },
      });
    } else {
      await tx.studentCourse.create({ data: { workspaceId: user.workspaceId, courseId, studentId, status: "active" } });
    }
  }

  return validStudentIds;
}

async function syncCourseSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  courseId: string,
  type: string,
  scheduleTimes: NormalizedScheduleTime[],
  studentIds: string[]
) {
  const desiredSchedules = buildDesiredSchedules(workspaceId, courseId, type, scheduleTimes, studentIds);

  await deleteSchedulesWithoutAttendance(tx, workspaceId, courseId);
  await preserveAttendedSchedules(tx, workspaceId, courseId, desiredSchedules);

  if (desiredSchedules.length > 0) {
    await tx.schedule.createMany({
      data: desiredSchedules,
    });
  }
}

export async function GET() {
  const user = await requireTeacherLike();
  const courses = await prisma.course.findMany({
    where: visibleCourseWhere(user),
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      _count: { select: { knowledgePoints: true, studentCourses: { where: { status: "active", student: visibleStudentWhere(user) } } } },
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
        createdById: user.role === "teacher" ? user.id : null,
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
        data: scheduleTimes.map((time) => ({
          workspaceId: user.workspaceId,
          courseId: created.id,
          type: "fixed",
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
          startDate: time.startDate,
          endDate: time.endDate,
          isActive: true,
        })),
      });
    }

    if (studentIds.length > 0) {
      const students = await tx.student.findMany({
        where: { ...visibleStudentWhere(user), id: { in: studentIds } },
        select: { id: true },
      });
      const validStudentIds = students.map((student) => student.id);

      if (validStudentIds.length > 0) {
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
              scheduleTimes.map((time) => ({
                workspaceId: user.workspaceId,
                studentId,
                courseId: created.id,
                type: "fixed",
                dayOfWeek: time.dayOfWeek,
                startTime: time.startTime,
                endTime: time.endTime,
                startDate: time.startDate,
                endDate: time.endDate,
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
    where: deletableCourseByIdWhere(user, id),
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.course.deleteMany({ where: deletableCourseByIdWhere(user, id) });
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
      where: visibleCourseByIdWhere(user, String(data.id)),
      select: { id: true, status: true },
    });
    if (!existing) return null;
    if (existing.status === "completed") return "completed";

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

    const validStudentIds = await syncCourseStudents(tx, user, existing.id, selectedStudentIds);
    await syncCourseSchedules(tx, user.workspaceId, existing.id, type, scheduleTimes, validStudentIds);

    return tx.course.findFirst({
      where: { id: existing.id, workspaceId: user.workspaceId },
      include: {
        scheduleTimes: { orderBy: { orderIndex: "asc" } },
        studentCourses: { where: { status: "active", student: visibleStudentWhere(user) }, include: { student: true } },
      },
    });
  });

  if (course === "completed") return NextResponse.json({ error: "course completed" }, { status: 400 });
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(course);
}

export async function PUT(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (data.action !== "complete") return NextResponse.json({ error: "invalid action" }, { status: 400 });
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const evaluations: { studentCourseId: string; evaluation: string }[] = Array.isArray(data.evaluations)
    ? data.evaluations
        .filter((item: { studentCourseId?: unknown; evaluation?: unknown }) => typeof item.studentCourseId === "string")
        .map((item: { studentCourseId?: string; evaluation?: unknown }) => ({
          studentCourseId: item.studentCourseId as string,
          evaluation: typeof item.evaluation === "string" ? item.evaluation.trim() : "",
        }))
    : [];
  const evaluationByStudentCourseId = new Map(evaluations.map((item) => [item.studentCourseId, item.evaluation]));
  const endedAt = new Date();

  const course = await prisma.$transaction(async (tx) => {
    const existing = await tx.course.findFirst({
      where: visibleCourseByIdWhere(user, String(data.id)),
      include: { studentCourses: { where: { status: "active", student: visibleStudentWhere(user) }, select: { id: true } } },
    });
    if (!existing) return null;

    await tx.course.update({
      where: { id: existing.id },
      data: { status: "completed", endedAt },
    });

    for (const studentCourse of existing.studentCourses) {
      await tx.studentCourse.update({
        where: { id: studentCourse.id },
        data: {
          status: "completed",
          endDate: endedAt,
          endEvaluation: evaluationByStudentCourseId.get(studentCourse.id) || null,
        },
      });
    }

    await tx.schedule.updateMany({
      where: { workspaceId: user.workspaceId, courseId: existing.id, isActive: true },
      data: { isActive: false },
    });

    return tx.course.findFirst({
      where: { id: existing.id, workspaceId: user.workspaceId },
      include: {
        scheduleTimes: { orderBy: { orderIndex: "asc" } },
        studentCourses: { where: { status: "completed", student: visibleStudentWhere(user) }, include: { student: true } },
      },
    });
  });

  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(course);
}
