import { prisma } from "@/lib/prisma";
import { getParentLearningLinks } from "@/lib/learning-links";

function formatLocalCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getParentVisibleAttendanceWhere(linkIds: string[]) {
  return {
    OR: [
      { learningLinkId: { in: linkIds } },
      { learningLinkId: null },
    ],
  };
}

function attendanceScore(record: {
  learningLinkId: string | null;
  lessonVideo?: unknown | null;
  createdAt: Date;
}) {
  return (record.lessonVideo ? 100 : 0) + (record.learningLinkId ? 10 : 0) + record.createdAt.getTime() / 100000000000000;
}

export function dedupeAttendanceRecords<T extends {
  scheduleId: string;
  studentId: string;
  date: Date;
  learningLinkId: string | null;
  lessonVideo?: unknown | null;
  createdAt: Date;
}>(records: T[]) {
  const byLesson = new Map<string, T>();

  for (const record of records) {
    const key = `${record.scheduleId}:${record.studentId}:${formatLocalCalendarDate(record.date)}`;
    const current = byLesson.get(key);
    if (!current || attendanceScore(record) > attendanceScore(current)) {
      byLesson.set(key, record);
    }
  }

  return [...byLesson.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getParentStudents(user: { id: string; workspaceId: string }) {
  const learningLinks = await getParentLearningLinks({ ...user, role: "parent" });
  const linkIds = learningLinks.map((link) => link.id);
  const parentStudents = await prisma.parentStudent.findMany({
    where: {
      parentId: user.id,
      student: { workspaceId: user.workspaceId },
    },
    include: {
      student: {
        include: {
          studentCourses: { where: { status: "active" }, include: { course: true } },
          attendance: {
            where: getParentVisibleAttendanceWhere(linkIds),
            orderBy: { date: "desc" },
            include: { schedule: true, lessonVideo: true },
          },
          exams: { orderBy: { date: "desc" } },
          schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
          kpProgress: {
            include: { knowledgePoint: true },
            orderBy: { knowledgePoint: { orderIndex: "asc" } },
          },
          weakPoints: {
            include: { reviewSchedules: { orderBy: { stage: "asc" } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  return parentStudents.map((item) => ({
    ...item,
    student: {
      ...item.student,
      attendance: dedupeAttendanceRecords(item.student.attendance),
    },
  }));
}

export async function getParentLearningData(
  user: { id: string; workspaceId: string; role: string },
  selectedLinkId?: string
) {
  const learningLinks = await getParentLearningLinks(user);
  const selectedLink = learningLinks.find((link) => link.id === selectedLinkId) || learningLinks[0] || null;
  const activeSelectedLinkId = selectedLink?.id || "";

  const parentStudents = selectedLink
    ? await prisma.parentStudent.findMany({
        where: {
          parentId: user.id,
          studentId: selectedLink.studentId,
          student: { workspaceId: user.workspaceId },
        },
        include: {
          student: {
            include: {
              studentCourses: { where: { status: "active" }, include: { course: true } },
              attendance: {
                where: { learningLinkId: activeSelectedLinkId },
                orderBy: { date: "desc" },
                include: { schedule: true, learningLink: { include: { teacher: true } } },
              },
              exams: {
                where: { learningLinkId: activeSelectedLinkId },
                orderBy: { date: "desc" },
                include: { learningLink: { include: { teacher: true } } },
              },
              schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
              kpProgress: {
                where: { learningLinkId: activeSelectedLinkId },
                include: { knowledgePoint: true, learningLink: { include: { teacher: true } } },
                orderBy: { knowledgePoint: { orderIndex: "asc" } },
              },
              weakPoints: {
                where: { learningLinkId: activeSelectedLinkId },
                include: { reviewSchedules: { orderBy: { stage: "asc" } }, learningLink: { include: { teacher: true } } },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      })
    : [];

  return {
    learningLinks,
    selectedLink,
    selectedLinkId: activeSelectedLinkId,
    parentStudents,
    teacher: selectedLink?.teacher || null,
    subject: selectedLink?.subject || "",
  };
}

export function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}
