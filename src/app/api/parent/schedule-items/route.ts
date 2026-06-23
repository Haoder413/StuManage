import { NextRequest, NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ParentUser = {
  id: string;
  workspaceId: string;
};

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

async function ensureParentOwnsStudent(user: ParentUser, studentId: string) {
  if (!studentId) return null;
  return prisma.parentStudent.findFirst({
    where: {
      parentId: user.id,
      studentId,
      student: { workspaceId: user.workspaceId },
    },
    include: { student: true },
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
    include: {
      student: true,
      teacher: { select: { id: true, name: true, teachingSubject: true } },
      course: true,
    },
  });
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? value : fallback;
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const user = await requireParent();
  const links = await prisma.learningLink.findMany({
    where: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
    },
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
  const scheduleFilters = [
    ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
    ...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []),
  ];

  const [schedules, parentItems] = await Promise.all([
    scheduleFilters.length > 0
      ? prisma.schedule.findMany({
          where: {
            workspaceId: user.workspaceId,
            OR: scheduleFilters,
          },
          include: {
            student: true,
            course: true,
            attendance: {
              where: {
                studentId: { in: studentIds },
                learningLinkId: { in: linkIds },
              },
              include: {
                learningLink: {
                  include: {
                    teacher: { select: { id: true, name: true, teachingSubject: true } },
                    course: true,
                  },
                },
              },
              orderBy: { date: "desc" },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    prisma.parentScheduleItem.findMany({
      where: {
        workspaceId: user.workspaceId,
        parentId: user.id,
      },
      include: {
        student: true,
        learningLink: {
          include: {
            teacher: { select: { id: true, name: true, teachingSubject: true } },
            course: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const teacherItems = schedules.flatMap((schedule) => {
    const matchingLinks = links.filter((link) => {
      if (schedule.studentId && schedule.studentId === link.studentId) return true;
      return Boolean(schedule.courseId && schedule.courseId === link.courseId);
    });

    return matchingLinks.map((link) => ({
      id: `teacher_schedule:${schedule.id}:${link.id}`,
      kind: "teacher_schedule" as const,
      readOnly: true,
      scheduleId: schedule.id,
      learningLinkId: link.id,
      studentId: link.studentId,
      student: link.student,
      teacher: link.teacher,
      courseId: schedule.courseId,
      course: schedule.course,
      subject: link.subject,
      type: schedule.type,
      title: schedule.course?.name || link.subject || "老师安排",
      dayOfWeek: schedule.dayOfWeek,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      notes: schedule.notes,
      attendance: schedule.attendance
        .filter((record) => record.studentId === link.studentId && record.learningLinkId === link.id)
        .map((record) => ({
          ...record,
          contentTags: parseTags(record.contentTags),
          feedbackTags: parseTags(record.feedbackTags),
          weakPointTags: parseTags(record.weakPointTags),
        })),
    }));
  });

  const personalItems = parentItems.map((item) => ({
    id: item.id,
    kind: "parent_item" as const,
    readOnly: false,
    parentId: item.parentId,
    studentId: item.studentId,
    student: item.student,
    learningLinkId: item.learningLinkId,
    learningLink: item.learningLink,
    title: item.title,
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  return NextResponse.json({
    links,
    items: [...teacherItems, ...personalItems],
  });
}

export async function POST(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const date = normalizeDate(data.date);
  const studentId = String(data.studentId || "");

  if (!title) return jsonError("missing title", 400);
  if (!date) return jsonError("missing date", 400);
  const parentStudent = await ensureParentOwnsStudent(user, studentId);
  if (!parentStudent) return jsonError("student not found", 403);

  const learningLinkId = data.learningLinkId ? String(data.learningLinkId) : null;
  const learningLink = learningLinkId ? await ensureParentCanUseLink(user, learningLinkId) : null;
  if (learningLinkId && (!learningLink || learningLink.studentId !== studentId)) {
    return jsonError("learning link not found", 403);
  }

  const item = await prisma.parentScheduleItem.create({
    data: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      studentId,
      learningLinkId,
      title,
      date,
      startTime: normalizeTime(data.startTime, "00:00"),
      endTime: normalizeTime(data.endTime, "23:59"),
      notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
    },
    include: {
      student: true,
      learningLink: {
        include: {
          teacher: { select: { id: true, name: true, teachingSubject: true } },
          course: true,
        },
      },
    },
  });

  return NextResponse.json({ kind: "parent_item", readOnly: false, ...item }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const id = String(data.id || "");
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const date = normalizeDate(data.date);
  const studentId = String(data.studentId || "");

  if (!id) return jsonError("missing id", 400);
  if (!title) return jsonError("missing title", 400);
  if (!date) return jsonError("missing date", 400);

  const existing = await prisma.parentScheduleItem.findFirst({
    where: {
      id,
      workspaceId: user.workspaceId,
      parentId: user.id,
    },
  });
  if (!existing) return jsonError("not found", 404);

  const parentStudent = await ensureParentOwnsStudent(user, studentId);
  if (!parentStudent) return jsonError("student not found", 403);

  const learningLinkId = data.learningLinkId ? String(data.learningLinkId) : null;
  const learningLink = learningLinkId ? await ensureParentCanUseLink(user, learningLinkId) : null;
  if (learningLinkId && (!learningLink || learningLink.studentId !== studentId)) {
    return jsonError("learning link not found", 403);
  }

  const item = await prisma.parentScheduleItem.update({
    where: { id: existing.id },
    data: {
      studentId,
      learningLinkId,
      title,
      date,
      startTime: normalizeTime(data.startTime, existing.startTime),
      endTime: normalizeTime(data.endTime, existing.endTime),
      notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
    },
    include: {
      student: true,
      learningLink: {
        include: {
          teacher: { select: { id: true, name: true, teachingSubject: true } },
          course: true,
        },
      },
    },
  });

  return NextResponse.json({ kind: "parent_item", readOnly: false, ...item });
}

export async function DELETE(request: NextRequest) {
  const user = await requireParent();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("missing id", 400);

  await prisma.parentScheduleItem.deleteMany({
    where: {
      id,
      workspaceId: user.workspaceId,
      parentId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
