import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { requireMobileParent } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

type ParentUser = { id: string; workspaceId: string };

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function formatCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseCalendarDate(text);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? value : fallback;
}

function normalizeSubjectLabel(value: unknown) {
  const label = typeof value === "string" ? value.trim() : "";
  return label.slice(0, 20) || "其他";
}

function parseRepeatDays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => Number(item))))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function buildRepeatDates(startDate: Date, endDate: Date, repeatDays: number[]) {
  const days = new Set(repeatDays);
  const dates: Date[] = [];
  const cursor = startOfDay(startDate);
  const end = startOfDay(endDate);
  while (cursor <= end) {
    if (days.has(cursor.getDay())) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureParentOwnsStudent(user: ParentUser, studentId: string) {
  if (!studentId) return null;
  return prisma.parentStudent.findFirst({
    where: {
      parentId: user.id,
      studentId,
      student: { workspaceId: user.workspaceId },
    },
  });
}

async function ensureParentCanUseLink(user: ParentUser, learningLinkId: string) {
  if (!learningLinkId) return null;
  return prisma.learningLink.findFirst({
    where: {
      id: learningLinkId,
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
    },
  });
}

function formatParentItem(item: {
  id: string;
  studentId: string;
  student: { name: string };
  learningLinkId: string | null;
  learningLink: { teacher: { name: string }; subject: string } | null;
  seriesId: string | null;
  subjectLabel: string;
  seriesEndDate: Date | null;
  repeatDays: string | null;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
}) {
  return {
    id: item.id,
    kind: "parent_item" as const,
    studentId: item.studentId,
    studentName: item.student.name,
    learningLinkId: item.learningLinkId,
    seriesId: item.seriesId,
    subjectLabel: item.subjectLabel,
    seriesEndDate: item.seriesEndDate ? formatCalendarDate(item.seriesEndDate) : null,
    repeatDays: parseTags(item.repeatDays).map((day) => Number(day)).filter((day) => Number.isInteger(day)),
    title: item.title,
    date: formatCalendarDate(item.date),
    startTime: item.startTime,
    endTime: item.endTime,
    notes: item.notes,
    teacherName: item.learningLink?.teacher.name,
    subject: item.learningLink?.subject,
  };
}

async function createItems({
  user,
  studentId,
  learningLinkId,
  title,
  date,
  startTime,
  endTime,
  notes,
  subjectLabel,
  repeatDays,
  seriesEndDate,
}: {
  user: ParentUser;
  studentId: string;
  learningLinkId: string | null;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
  subjectLabel: string;
  repeatDays: number[];
  seriesEndDate: Date | null;
}) {
  const dates = repeatDays.length === 0 ? [date] : buildRepeatDates(date, seriesEndDate as Date, repeatDays);
  if (dates.length === 0) throw new Error("repeat dates empty");
  const seriesId = repeatDays.length > 0 ? randomUUID() : null;
  const repeatDaysSnapshot = repeatDays.length > 0 ? JSON.stringify(repeatDays.map(String)) : null;

  return prisma.$transaction(
    dates.map((itemDate) =>
      prisma.parentScheduleItem.create({
        data: {
          workspaceId: user.workspaceId,
          parentId: user.id,
          studentId,
          learningLinkId,
          seriesId,
          subjectLabel,
          seriesEndDate: repeatDays.length > 0 ? seriesEndDate : null,
          repeatDays: repeatDaysSnapshot,
          title,
          date: itemDate,
          startTime,
          endTime,
          notes,
        },
        include: {
          student: true,
          learningLink: { include: { teacher: { select: { id: true, name: true } } } },
        },
      })
    )
  );
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireMobileParent(request);
  if (response) return response;

  const links = await prisma.learningLink.findMany({
    where: { workspaceId: user.workspaceId, parentId: user.id, isActive: true },
    include: {
      student: true,
      teacher: { select: { id: true, name: true, teachingSubject: true } },
      course: true,
    },
    orderBy: [{ student: { name: "asc" } }, { subject: "asc" }],
  });

  const studentIds = [...new Set(links.map((link) => link.studentId))];
  const courseIds = [...new Set(links.map((link) => link.courseId).filter((id): id is string => Boolean(id)))];
  const linkIds = links.map((link) => link.id);
  const activeLinkCountByStudent = new Map<string, number>();
  const studentCoursePairs = new Map<string, { studentId: string; courseId: string }>();

  for (const link of links) {
    activeLinkCountByStudent.set(link.studentId, (activeLinkCountByStudent.get(link.studentId) || 0) + 1);
    if (link.courseId) studentCoursePairs.set(`${link.studentId}:${link.courseId}`, { studentId: link.studentId, courseId: link.courseId });
  }

  const singleLinkStudentIds = studentIds.filter((studentId) => activeLinkCountByStudent.get(studentId) === 1);
  const scheduleFilters: Prisma.ScheduleWhereInput[] = [
    ...(courseIds.length > 0 ? [{ studentId: null, courseId: { in: courseIds } }] : []),
    ...[...studentCoursePairs.values()].map(({ studentId, courseId }) => ({ studentId, courseId })),
    ...(singleLinkStudentIds.length > 0 ? [{ studentId: { in: singleLinkStudentIds }, courseId: null }] : []),
  ];

  const [schedules, parentItems] = await Promise.all([
    scheduleFilters.length > 0
      ? prisma.schedule.findMany({
          where: { workspaceId: user.workspaceId, OR: scheduleFilters },
          include: {
            student: true,
            course: true,
            attendance: {
              where: { studentId: { in: studentIds }, learningLinkId: { in: linkIds } },
              orderBy: { date: "desc" },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    prisma.parentScheduleItem.findMany({
      where: { workspaceId: user.workspaceId, parentId: user.id },
      include: {
        student: true,
        learningLink: { include: { teacher: { select: { id: true, name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const teacherItems = schedules.flatMap((schedule) => {
    const matchingLinks = links.filter((link) => {
      if (!schedule.studentId) return Boolean(schedule.courseId && schedule.courseId === link.courseId);
      if (schedule.studentId !== link.studentId) return false;
      if (schedule.courseId) return schedule.courseId === link.courseId;
      return activeLinkCountByStudent.get(schedule.studentId) === 1;
    });

    return matchingLinks.map((link) => ({
      id: `teacher_schedule:${schedule.id}:${link.id}`,
      kind: "teacher_schedule" as const,
      scheduleId: schedule.id,
      learningLinkId: link.id,
      studentId: link.studentId,
      studentName: link.student.name,
      teacherName: link.teacher.name,
      subject: link.subject,
      title: schedule.course?.name || link.subject || "老师安排",
      courseName: schedule.course?.name || null,
      courseType: schedule.type,
      dayOfWeek: schedule.dayOfWeek,
      date: schedule.date ? formatCalendarDate(schedule.date) : null,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      notes: schedule.notes,
      attendance: schedule.attendance
        .filter((record) => record.studentId === link.studentId && record.learningLinkId === link.id)
        .map((record) => {
          const weakPointTags = parseTags(record.weakPointTags);
          return {
            id: record.id,
            date: formatCalendarDate(record.date),
            status: record.status,
            lessonContent: record.lessonContent,
            lessonFeedback: record.lessonFeedback,
            weakPointTags,
            weakPointText: weakPointTags.join("、"),
          };
        }),
    }));
  });

  return NextResponse.json({
    links: links.map((link) => ({
      id: link.id,
      studentId: link.studentId,
      studentName: link.student.name,
      subject: link.subject,
      teacherName: link.teacher.name,
      label: `${link.student.name} · ${link.subject}`,
    })),
    items: [...teacherItems, ...parentItems.map(formatParentItem)],
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireMobileParent(request);
  if (response) return response;
  const data = await request.json();
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const date = normalizeDate(data.date);
  const studentId = String(data.studentId || "");
  const repeatDays = parseRepeatDays(data.repeatDays);
  const seriesEndDate = repeatDays.length > 0 ? normalizeDate(data.seriesEndDate) : null;
  if (!title) return jsonError("missing title", 400);
  if (!date) return jsonError("missing date", 400);
  if (repeatDays.length > 0 && !seriesEndDate) return jsonError("missing series end date", 400);
  if (seriesEndDate && seriesEndDate < date) return jsonError("series end date cannot be before start date", 400);
  if (!(await ensureParentOwnsStudent(user, studentId))) return jsonError("student not found", 403);

  const learningLinkId = data.learningLinkId ? String(data.learningLinkId) : null;
  const learningLink = learningLinkId ? await ensureParentCanUseLink(user, learningLinkId) : null;
  if (learningLinkId && (!learningLink || learningLink.studentId !== studentId)) return jsonError("learning link not found", 403);

  const items = await createItems({
    user,
    studentId,
    learningLinkId,
    title,
    date,
    startTime: normalizeTime(data.startTime, "09:00"),
    endTime: normalizeTime(data.endTime, "10:00"),
    notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
    subjectLabel: normalizeSubjectLabel(data.subjectLabel),
    repeatDays,
    seriesEndDate,
  });
  return NextResponse.json(items.map(formatParentItem), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireMobileParent(request);
  if (response) return response;
  const data = await request.json();
  const id = String(data.id || "");
  if (!id) return jsonError("missing id", 400);
  const existing = await prisma.parentScheduleItem.findFirst({ where: { id, workspaceId: user.workspaceId, parentId: user.id } });
  if (!existing) return jsonError("not found", 404);

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const date = normalizeDate(data.date);
  const studentId = String(data.studentId || "");
  const repeatDays = parseRepeatDays(data.repeatDays);
  const seriesEndDate = repeatDays.length > 0 ? normalizeDate(data.seriesEndDate) : null;
  if (!title) return jsonError("missing title", 400);
  if (!date) return jsonError("missing date", 400);
  if (repeatDays.length > 0 && !seriesEndDate) return jsonError("missing series end date", 400);
  if (seriesEndDate && seriesEndDate < date) return jsonError("series end date cannot be before start date", 400);
  if (!(await ensureParentOwnsStudent(user, studentId))) return jsonError("student not found", 403);

  const learningLinkId = data.learningLinkId ? String(data.learningLinkId) : null;
  const learningLink = learningLinkId ? await ensureParentCanUseLink(user, learningLinkId) : null;
  if (learningLinkId && (!learningLink || learningLink.studentId !== studentId)) return jsonError("learning link not found", 403);

  const deleteWhere = existing.seriesId
    ? { workspaceId: user.workspaceId, parentId: user.id, seriesId: existing.seriesId }
    : { workspaceId: user.workspaceId, parentId: user.id, id: existing.id };
  await prisma.parentScheduleItem.deleteMany({ where: deleteWhere });
  const items = await createItems({
    user,
    studentId,
    learningLinkId,
    title,
    date,
    startTime: normalizeTime(data.startTime, existing.startTime),
    endTime: normalizeTime(data.endTime, existing.endTime),
    notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
    subjectLabel: normalizeSubjectLabel(data.subjectLabel),
    repeatDays,
    seriesEndDate,
  });
  return NextResponse.json(items.map(formatParentItem));
}

export async function DELETE(request: NextRequest) {
  const { user, response } = await requireMobileParent(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("missing id", 400);
  const existing = await prisma.parentScheduleItem.findFirst({ where: { id, workspaceId: user.workspaceId, parentId: user.id } });
  if (!existing) return jsonError("not found", 404);
  const result = await prisma.parentScheduleItem.deleteMany({
    where: existing.seriesId
      ? { workspaceId: user.workspaceId, parentId: user.id, seriesId: existing.seriesId }
      : { id, workspaceId: user.workspaceId, parentId: user.id },
  });
  return NextResponse.json({ success: true, deletedCount: result.count });
}
