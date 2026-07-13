import { prisma } from "@/lib/prisma";
import { calculateConsistentProgressStatuses } from "@/lib/knowledge-progress-tree";
import { dedupeAttendanceRecords } from "@/lib/parent-data";
import { dedupeWeakPoints } from "@/lib/weak-points";
import {
  teacherSeesAllWorkspaceData,
  visibleExamWhere,
  visibleStudentByIdWhere,
  visibleStudentWhere,
  type TeacherVisibilityUser,
} from "@/lib/teacher-visibility";

export type StudentReportVersion = "parent" | "internal";

export type StudentReportRange = {
  from: Date | null;
  toExclusive: Date | null;
  label: string;
};

export function normalizeReportVersion(value?: string): StudentReportVersion {
  return value === "internal" ? "internal" : "parent";
}

function parseCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildReportDateRange(fromValue?: string, toValue?: string): StudentReportRange {
  let from = parseCalendarDate(fromValue);
  let to = parseCalendarDate(toValue);
  if (from && to && from > to) [from, to] = [to, from];
  const toExclusive = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : null;
  const fromLabel = from ? from.toISOString().slice(0, 10) : "最早记录";
  const toLabel = to ? to.toISOString().slice(0, 10) : "至今";
  return {
    from,
    toExclusive,
    label: !from && !to ? "全部历史" : `${fromLabel} 至 ${toLabel}`,
  };
}

export function isDateInReportRange(date: Date, range: StudentReportRange) {
  return (!range.from || date >= range.from) && (!range.toExclusive || date < range.toExclusive);
}

function dateWhere(range: StudentReportRange) {
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.toExclusive ? { lt: range.toExclusive } : {}),
  };
}

function relationScope(user: TeacherVisibilityUser, allowLegacy: boolean) {
  if (teacherSeesAllWorkspaceData(user)) return {};
  return {
    OR: [
      { learningLink: { workspaceId: user.workspaceId, teacherId: user.id, isActive: true } },
      ...(allowLegacy ? [{ learningLinkId: null }] : []),
    ],
  };
}

function reportCourseScope(user: TeacherVisibilityUser, studentId: string, allowLegacy: boolean) {
  if (teacherSeesAllWorkspaceData(user)) return { workspaceId: user.workspaceId };
  return {
    workspaceId: user.workspaceId,
    OR: [
      {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            studentId,
            teacherId: user.id,
            isActive: true,
          },
        },
      },
      ...(allowLegacy ? [{
        createdById: user.id,
        learningLinks: {
          none: {
            workspaceId: user.workspaceId,
            studentId,
          },
        },
      }] : []),
    ],
  };
}

export async function getStudentReportOptions(user: TeacherVisibilityUser) {
  return prisma.student.findMany({
    where: visibleStudentWhere(user),
    select: { id: true, name: true, grade: true },
    orderBy: { name: "asc" },
  });
}

export async function getStudentReport(
  user: TeacherVisibilityUser,
  studentId: string,
  input: { version?: string; from?: string; to?: string },
) {
  const version = normalizeReportVersion(input.version);
  const range = buildReportDateRange(input.from, input.to);
  const student = await prisma.student.findFirst({
    where: visibleStudentByIdWhere(user, studentId),
    select: {
      id: true,
      name: true,
      grade: true,
      parentContact: true,
      enrollmentDate: true,
      lessonFrequency: true,
      tuition: true,
      totalLessonHours: true,
      remainingLessonHours: true,
      notes: true,
      createdById: true,
    },
  });
  if (!student) return null;

  const seesAll = teacherSeesAllWorkspaceData(user);
  const allowLegacy = seesAll || student.createdById === user.id;
  const scopedRelations = relationScope(user, allowLegacy);
  const scopedCourses = reportCourseScope(user, student.id, allowLegacy);
  const rangeWhere = dateWhere(range);

  const [learningLinks, studentCourses, attendanceRaw, exams, homework, kpProgress, weakPointsRaw, lessonHourLogs] = await Promise.all([
    prisma.learningLink.findMany({
      where: {
        workspaceId: user.workspaceId,
        studentId: student.id,
        ...(seesAll ? {} : { teacherId: user.id }),
      },
      include: {
        teacher: { select: { id: true, name: true, teachingSubject: true } },
        course: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studentCourse.findMany({
      where: {
        workspaceId: user.workspaceId,
        studentId: student.id,
        course: scopedCourses,
      },
      include: {
        course: {
          include: { knowledgePoints: { orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }] } },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        workspaceId: user.workspaceId,
        studentId: student.id,
        date: rangeWhere,
        ...scopedRelations,
      },
      include: {
        schedule: { include: { course: { select: { id: true, name: true } } } },
        learningLink: {
          include: {
            teacher: { select: { id: true, name: true, teachingSubject: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.exam.findMany({
      where: {
        studentId: student.id,
        reviewStatus: "approved",
        date: rangeWhere,
        ...visibleExamWhere(user),
      },
      include: { learningLink: { include: { course: true, teacher: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    }),
    prisma.homeworkSubmission.findMany({
      where: {
        workspaceId: user.workspaceId,
        studentId: student.id,
        assignment: { course: scopedCourses },
        OR: [
          { currentVersion: { is: { submittedAt: rangeWhere } } },
          { currentVersionId: null, createdAt: rangeWhere },
        ],
      },
      include: {
        assignment: { include: { course: { select: { id: true, name: true } } } },
        currentVersion: { select: { versionNumber: true, submittedAt: true, totalScore: true, overallComment: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studentKpProgress.findMany({
      where: { workspaceId: user.workspaceId, studentId: student.id, ...scopedRelations },
      include: { knowledgePoint: { include: { course: { select: { id: true, name: true } } } } },
      orderBy: { knowledgePoint: { orderIndex: "asc" } },
    }),
    prisma.weakPoint.findMany({
      where: { workspaceId: user.workspaceId, studentId: student.id, ...scopedRelations },
      include: { reviewSchedules: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    version === "internal"
      ? prisma.lessonHourLog.findMany({
          where: {
            workspaceId: user.workspaceId,
            studentId: student.id,
            createdAt: rangeWhere,
            ...(seesAll
              ? {}
              : {
                  OR: [
                    { attendance: { learningLink: { teacherId: user.id, isActive: true } } },
                    ...(allowLegacy ? [{ attendanceId: null }, { attendance: { learningLinkId: null } }] : []),
                  ],
                }),
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const attendance = dedupeAttendanceRecords(attendanceRaw);
  const weakPoints = dedupeWeakPoints(weakPointsRaw).map((point) => ({
    ...point,
    reviewSchedules: point.reviewSchedules.filter((schedule) =>
      isDateInReportRange(schedule.lastReviewedAt || schedule.createdAt, range),
    ),
  })).filter((point) => isDateInReportRange(point.createdAt, range) || point.reviewSchedules.length > 0);

  const actualProgress = new Map(kpProgress.map((item) => [item.knowledgePointId, item]));
  const knowledgePoints = studentCourses.flatMap((item) => item.course.knowledgePoints).map((point) => {
    const progress = actualProgress.get(point.id);
    return {
      id: point.id,
      courseId: point.courseId,
      courseName: studentCourses.find((item) => item.courseId === point.courseId)?.course.name || "未归属课程",
      name: point.name,
      parentId: point.parentId,
      orderIndex: point.orderIndex,
      status: progress?.status || "learning",
      masteredAt: progress?.masteredAt || null,
    };
  });
  for (const progress of kpProgress) {
    if (knowledgePoints.some((point) => point.id === progress.knowledgePointId)) continue;
    knowledgePoints.push({
      id: progress.knowledgePointId,
      courseId: progress.knowledgePoint.courseId,
      courseName: progress.knowledgePoint.course.name,
      name: progress.knowledgePoint.name,
      parentId: progress.knowledgePoint.parentId,
      orderIndex: progress.knowledgePoint.orderIndex,
      status: progress.status,
      masteredAt: progress.masteredAt,
    });
  }
  const consistentStatuses = calculateConsistentProgressStatuses(
    knowledgePoints.map((point) => ({ id: point.id, parentId: point.parentId })),
    Object.fromEntries(knowledgePoints.map((point) => [point.id, point.status])),
  );
  const normalizedKnowledgePoints = knowledgePoints
    .map((point) => ({ ...point, status: consistentStatuses[point.id] || "learning" }))
    .sort((a, b) => a.courseName.localeCompare(b.courseName, "zh-CN") || a.orderIndex - b.orderIndex);

  const presentCount = attendance.filter((item) => item.status === "present" || item.status === "makeup").length;
  const approvedScores = exams.filter((exam) => exam.totalScore > 0).map((exam) => (exam.score / exam.totalScore) * 100);
  const gradedHomework = homework.filter((item) => item.totalScore !== null || item.currentVersion?.totalScore !== null);
  const completedReviews = weakPoints.flatMap((point) => point.reviewSchedules).filter((item) => item.status === "completed");

  return {
    version,
    range,
    generatedAt: new Date(),
    student,
    learningLinks,
    studentCourses,
    attendance,
    exams,
    homework,
    knowledgePoints: normalizedKnowledgePoints,
    weakPoints,
    lessonHourLogs,
    summary: {
      lessonCount: attendance.length,
      presentCount,
      attendanceRate: attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0,
      examCount: exams.length,
      averageScoreRate: approvedScores.length ? Math.round(approvedScores.reduce((sum, score) => sum + score, 0) / approvedScores.length) : 0,
      homeworkCount: homework.length,
      gradedHomeworkCount: gradedHomework.length,
      masteredKnowledgeCount: normalizedKnowledgePoints.filter((item) => item.status === "mastered").length,
      knowledgeCount: normalizedKnowledgePoints.length,
      activeWeakPointCount: weakPoints.filter((item) => item.status === "active").length,
      masteredWeakPointCount: weakPoints.filter((item) => item.status !== "active").length,
      completedReviewCount: completedReviews.length,
    },
  };
}
