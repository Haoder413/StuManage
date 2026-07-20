import { prisma } from "@/lib/prisma";
import { calculateConsistentProgressStatuses } from "@/lib/knowledge-progress-tree";
import { getParentLearningLinks } from "@/lib/learning-links";
import { dedupeWeakPoints } from "@/lib/weak-points";

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
  lessonAttachments?: unknown[] | null;
  createdAt: Date;
}) {
  return (
    (record.lessonVideo ? 100 : 0) +
    (record.lessonAttachments?.length ? 50 : 0) +
    (record.learningLinkId ? 10 : 0) +
    record.createdAt.getTime() / 100000000000000
  );
}

export function dedupeAttendanceRecords<T extends {
  scheduleId: string;
  studentId: string;
  date: Date;
  learningLinkId: string | null;
  lessonVideo?: unknown | null;
  lessonAttachments?: unknown[] | null;
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

type ParentKnowledgePoint = {
  id: string;
  workspaceId: string;
  courseId: string;
  name: string;
  parentId: string | null;
  orderIndex: number;
  createdAt: Date;
};

type ParentKnowledgeProgress = {
  id: string;
  workspaceId: string;
  learningLinkId: string | null;
  studentId: string;
  knowledgePointId: string;
  status: string;
  masteredAt: Date | null;
  updatedAt: Date;
  knowledgePoint: ParentKnowledgePoint;
};

type StudentCourseWithKnowledgePoints = {
  course: {
    knowledgePoints: ParentKnowledgePoint[];
  };
};

export function progressKey(knowledgePointId: string) {
  return knowledgePointId;
}

function compareParentKnowledgeProgress(a: ParentKnowledgeProgress, b: ParentKnowledgeProgress) {
  if (a.knowledgePoint.courseId !== b.knowledgePoint.courseId) {
    return a.knowledgePoint.courseId.localeCompare(b.knowledgePoint.courseId);
  }
  if ((a.knowledgePoint.parentId || "") !== (b.knowledgePoint.parentId || "")) {
    return (a.knowledgePoint.parentId || "").localeCompare(b.knowledgePoint.parentId || "");
  }
  if (a.knowledgePoint.orderIndex !== b.knowledgePoint.orderIndex) {
    return a.knowledgePoint.orderIndex - b.knowledgePoint.orderIndex;
  }
  return a.knowledgePoint.name.localeCompare(b.knowledgePoint.name, "zh-CN");
}

function preferKnowledgeProgress(next: ParentKnowledgeProgress, current?: ParentKnowledgeProgress) {
  if (!current) return next;
  if (next.status === "mastered" && current.status !== "mastered") return next;
  if (next.status !== "mastered" && current.status === "mastered") return current;
  return next.updatedAt.getTime() > current.updatedAt.getTime() ? next : current;
}

export function withSyntheticKnowledgeProgress<
  T extends { student: { id: string; workspaceId: string; studentCourses: StudentCourseWithKnowledgePoints[]; kpProgress: ParentKnowledgeProgress[] } }
>(item: T): T {
  const progressByKnowledgePoint = new Map<string, ParentKnowledgeProgress>();

  item.student.kpProgress.forEach((progress) => {
    const key = progressKey(progress.knowledgePointId);
    progressByKnowledgePoint.set(key, preferKnowledgeProgress(progress, progressByKnowledgePoint.get(key)));
  });

  item.student.studentCourses.forEach((studentCourse) => {
    studentCourse.course.knowledgePoints.forEach((knowledgePoint) => {
      const key = progressKey(knowledgePoint.id);
      if (progressByKnowledgePoint.has(key)) return;
      progressByKnowledgePoint.set(key, {
        id: `synthetic-parent-${item.student.id}-${knowledgePoint.id}`,
        workspaceId: item.student.workspaceId,
        learningLinkId: null,
        studentId: item.student.id,
        knowledgePointId: knowledgePoint.id,
        status: "learning",
        masteredAt: null,
        updatedAt: new Date(0),
        knowledgePoint,
      });
    });
  });

  const progressItems = [...progressByKnowledgePoint.values()];
  const consistentStatuses = calculateConsistentProgressStatuses(
    progressItems.map((progress) => ({
      id: progress.knowledgePointId,
      parentId: progress.knowledgePoint.parentId,
    })),
    Object.fromEntries(progressItems.map((progress) => [progress.knowledgePointId, progress.status])),
  );

  return {
    ...item,
    student: {
      ...item.student,
      kpProgress: progressItems
        .map((progress) => ({
          ...progress,
          status: consistentStatuses[progress.knowledgePointId] || "learning",
        }))
        .sort(compareParentKnowledgeProgress),
    },
  } as T;
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
          studentCourses: {
            where: { status: "active" },
            include: {
              course: {
                include: {
                  knowledgePoints: { orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }] },
                },
              },
            },
          },
          attendance: {
            where: getParentVisibleAttendanceWhere(linkIds),
            orderBy: { date: "desc" },
            include: {
              schedule: { include: { course: true } },
              lessonVideo: true,
              lessonAttachments: true,
              attendanceClassHomeworks: true,
              attendanceStudentAnswers: true,
              learningLink: {
                include: {
                  teacher: { select: { id: true, name: true, teachingSubject: true } },
                  course: true,
                },
              },
            },
          },
          exams: { orderBy: { date: "desc" } },
          schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
          kpProgress: {
            where: getParentVisibleAttendanceWhere(linkIds),
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

  return parentStudents.map((item) => {
    const itemWithKnowledgeProgress = withSyntheticKnowledgeProgress(item);
    return {
      ...itemWithKnowledgeProgress,
      student: {
        ...itemWithKnowledgeProgress.student,
        attendance: dedupeAttendanceRecords(item.student.attendance),
        weakPoints: dedupeWeakPoints(item.student.weakPoints),
      },
    };
  });
}

export async function getParentLearningData(
  user: { id: string; workspaceId: string; role: string },
  selectedLinkId?: string
) {
  const learningLinks = await getParentLearningLinks(user);
  const selectedLink = learningLinks.find((link) => link.id === selectedLinkId) || learningLinks[0] || null;
  const activeSelectedLinkId = selectedLink?.id || "";

  // 兼容历史数据：教师可能早于家长账号/学习链接创建考勤、成绩、知识点进度、薄弱点，
  // 这些数据的 learningLinkId 为 NULL。家长选中某个学习链接时，应同时看到自己孩子的
  // 旧数据，否则家长端会与教师端不一致。
  const legacyVisibleWhere = {
    OR: [{ learningLinkId: activeSelectedLinkId }, { learningLinkId: null }],
  };
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
              attendance: {
                where: legacyVisibleWhere,
                orderBy: { date: "desc" },
                include: { schedule: true, learningLink: { include: { teacher: true } } },
              },
              exams: {
                where: legacyVisibleWhere,
                orderBy: { date: "desc" },
                include: { learningLink: { include: { teacher: true } } },
              },
              schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
              studentCourses: {
                where: {
                  status: "active",
                  ...(selectedLink.courseId ? { courseId: selectedLink.courseId } : {}),
                },
                include: {
                  course: {
                    include: {
                      knowledgePoints: { orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }] },
                    },
                  },
                },
              },
              kpProgress: {
                where: legacyVisibleWhere,
                include: { knowledgePoint: true, learningLink: { include: { teacher: true } } },
                orderBy: { knowledgePoint: { orderIndex: "asc" } },
              },
              weakPoints: {
                where: legacyVisibleWhere,
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
    parentStudents: parentStudents.map((item) => {
      const itemWithKnowledgeProgress = withSyntheticKnowledgeProgress(item);
      return {
        ...itemWithKnowledgeProgress,
        student: {
          ...itemWithKnowledgeProgress.student,
          attendance: dedupeAttendanceRecords(item.student.attendance),
          weakPoints: dedupeWeakPoints(item.student.weakPoints),
        },
      };
    }),
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
