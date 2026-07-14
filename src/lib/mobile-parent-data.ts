import { getParentStudents, parseTags } from "@/lib/parent-data";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getVisibleResourceGroupWhere, resolveParentResourcePermissions } from "@/lib/resource-group-access";
import { parseResourceGroupQuery } from "@/lib/resource-library-validation";
import { resourceGradeSearchTerms } from "@/lib/resource-metadata";
import { getWeakPointStatusCounts } from "@/lib/weak-points";

type MobileParentUser = {
  id: string;
  name: string;
  workspaceId: string;
  role: string;
};

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function examTypeLabel(type: string) {
  if (type === "entrance") return "摸底";
  if (type === "monthly") return "阶段测试";
  if (type === "quiz") return "随堂小测";
  return type;
}

function attendanceStatusLabel(status: string) {
  if (status === "present") return "正常上课";
  if (status === "makeup") return "补课";
  if (status === "absent") return "请假";
  return status;
}

function homeworkStatusLabel(status: string, dueAt?: Date | string | null) {
  if (status === "graded") return "已批改";
  if (status === "submitted") return "已提交";
  if (status === "pending" && dueAt && new Date(dueAt).getTime() < Date.now()) return "已逾期";
  return "待提交";
}

function normalizeCourseName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function getMobileParentHome(user: MobileParentUser) {
  const parentStudents = await getParentStudents(user);

  return {
    user: { id: user.id, name: user.name },
    students: parentStudents.map(({ student }) => {
      const approvedExams = student.exams.filter((exam) => exam.reviewStatus === "approved");
      const seenCourseNames = new Set<string>();
      const courses = student.studentCourses
        .filter((item) => item.status === "active")
        .reduce<{ id: string; name: string }[]>((items, item) => {
          const courseName = normalizeCourseName(item.course.name);
          if (seenCourseNames.has(courseName)) return items;
          seenCourseNames.add(courseName);
          items.push({ id: item.course.id, name: courseName || item.course.name });
          return items;
        }, []);
      return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        remainingLessonHours: student.remainingLessonHours,
        totalLessonHours: student.totalLessonHours,
        courses,
        weakPointCount: student.weakPoints.filter((point) => point.status === "active").length,
        latestLessons: student.attendance.slice(0, 3).map((item) => ({
          id: item.id,
          date: isoDate(item.date),
          status: item.status,
          statusLabel: attendanceStatusLabel(item.status),
          lessonContent: item.lessonContent,
          lessonFeedback: item.lessonFeedback,
          weakPointTags: parseTags(item.weakPointTags),
        })),
        latestExams: approvedExams.slice(0, 3).map((exam) => ({
          id: exam.id,
          name: exam.name,
          type: exam.type,
          typeLabel: examTypeLabel(exam.type),
          score: exam.score,
          totalScore: exam.totalScore,
          percent: Math.round((exam.score / exam.totalScore) * 100),
          date: isoDate(exam.date),
        })),
      };
    }),
  };
}

export async function getMobileParentExams(user: MobileParentUser) {
  const parentStudents = await getParentStudents(user);

  return {
    students: parentStudents.map(({ student }) => {
      const exams = student.exams.filter((exam) => exam.reviewStatus === "approved");
      const scores = exams.map((exam) => Math.round((exam.score / exam.totalScore) * 100));
      const average = scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : null;
      return {
        id: student.id,
        name: student.name,
        average,
        examCount: exams.length,
        exams: exams.map((exam) => ({
          id: exam.id,
          name: exam.name,
          type: exam.type,
          typeLabel: examTypeLabel(exam.type),
          score: exam.score,
          totalScore: exam.totalScore,
          percent: Math.round((exam.score / exam.totalScore) * 100),
          date: isoDate(exam.date),
          notes: exam.notes,
        })),
      };
    }),
  };
}

export async function getMobileParentProgress(user: MobileParentUser) {
  const parentStudents = await getParentStudents(user);

  return {
    students: parentStudents.map(({ student }) => {
      const totalKps = student.kpProgress.length;
      const masteredCount = student.kpProgress.filter((item) => item.status === "mastered").length;
      const learningCount = Math.max(totalKps - masteredCount, 0);
      const weakPointCounts = getWeakPointStatusCounts(student.weakPoints);
      return {
        id: student.id,
        name: student.name,
        totalKps,
        masteredCount,
        learningCount,
        currentWeakPointCount: weakPointCounts.pending,
        pendingWeakPointCount: weakPointCounts.pending,
        masteredWeakPointCount: weakPointCounts.mastered,
        progressPercent: totalKps > 0 ? Math.round((masteredCount / totalKps) * 100) : 0,
        knowledgePoints: student.kpProgress.map((item) => ({
          id: item.id,
          name: item.knowledgePoint.name,
          status: item.status,
        })),
        weakPoints: student.weakPoints.map((point) => {
          const completedReviewCount = point.reviewSchedules.filter((schedule) => schedule.status === "completed").length;
          const lastReviewed = point.reviewSchedules
            .filter((schedule) => schedule.lastReviewedAt)
            .sort((a, b) => new Date(b.lastReviewedAt || "").getTime() - new Date(a.lastReviewedAt || "").getTime())[0];
          return {
            id: point.id,
            description: point.description,
            status: point.status,
            statusLabel: point.status === "active" ? "待复习" : "已掌握",
            createdAt: isoDate(point.createdAt),
            masteredAt: isoDate(point.masteredAt),
            completedReviewCount,
            lastReviewedAt: isoDate(lastReviewed?.lastReviewedAt),
          };
        }),
      };
    }),
  };
}

export async function getMobileResources(user: MobileParentUser, searchParams = new URLSearchParams()) {
  const query = parseResourceGroupQuery(searchParams);
  const conditions: Prisma.ResourceGroupWhereInput[] = [getVisibleResourceGroupWhere(user)];
  if (query.grade) conditions.push({ OR: resourceGradeSearchTerms(query.grade).map((term) => (
    term.mode === "startsWith" ? { grade: { startsWith: term.alias } } : { grade: { contains: term.alias } }
  )) });
  if (query.year === "unset") conditions.push({ year: null });
  else if (query.year !== null) conditions.push({ year: query.year });
  if (query.subject) conditions.push({ subject: query.subject });
  if (query.resourceKind) conditions.push({ resourceKind: query.resourceKind });
  if (query.courseId) conditions.push({ coursePermissions: { some: { courseId: query.courseId } } });
  if (query.q) conditions.push({ OR: [
    { title: { contains: query.q } },
    { grade: { contains: query.q } },
    { subject: { contains: query.q } },
    { files: { some: { originalName: { contains: query.q } } } },
    { tags: { some: { tag: { name: { contains: query.q } } } } },
  ] });
  const where: Prisma.ResourceGroupWhereInput = { AND: conditions };
  const [total, groups, courseLinks] = await prisma.$transaction([
    prisma.resourceGroup.count({ where }),
    prisma.resourceGroup.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        files: { orderBy: [{ role: "asc" }, { orderIndex: "asc" }] },
        tags: { include: { tag: { select: { name: true } } } },
        permissions: { where: { userId: user.id }, select: { canPreview: true, canDownload: true } },
        coursePermissions: { include: { course: {
          select: {
            id: true,
            name: true,
            learningLinks: { where: { parentId: user.id, workspaceId: user.workspaceId, isActive: true }, select: { id: true } },
          },
        } } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.learningLink.findMany({
      where: { parentId: user.id, workspaceId: user.workspaceId, isActive: true, courseId: { not: null } },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const resources = groups.map((group) => {
    const direct = group.permissions[0];
    const courseAccess = group.coursePermissions.some((permission) => permission.course.learningLinks.length > 0);
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      resourceKind: group.resourceKind,
      subject: group.subject,
      grade: group.grade,
      year: group.year,
      tags: group.tags.map((relation) => relation.tag.name),
      totalSize: group.totalSize,
      uploadedByName: group.createdBy.name,
      createdAt: isoDate(group.createdAt),
      updatedAt: isoDate(group.updatedAt),
      courses: group.coursePermissions.filter((permission) => permission.course.learningLinks.length > 0).map((permission) => ({ id: permission.course.id, name: permission.course.name })),
      files: group.files.map((file) => {
        const { canPreview, canDownload } = resolveParentResourcePermissions(direct, courseAccess);
        const base = `/api/mobile/resources/${group.id}/files/${file.id}`;
        return {
          id: file.id,
          originalName: file.originalName,
          extension: file.extension,
          size: file.size,
          role: file.role,
          canPreview,
          canDownload,
          previewUrl: canPreview ? `${base}?mode=preview` : null,
          downloadUrl: canDownload ? `${base}?mode=download` : null,
        };
      }),
    };
  });
  return {
    resources,
    courseOptions: Array.from(new Map(
      courseLinks.filter((link) => link.course).map((link) => [link.course!.id, link.course!])
    ).values()),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasNextPage: query.page * query.pageSize < total,
  };
}

export async function getMobileParentHomework(user: MobileParentUser) {
  const submissions = await prisma.homeworkSubmission.findMany({
    where: {
      workspaceId: user.workspaceId,
      assignment: { status: "published" },
      student: { parentLinks: { some: { parentId: user.id } } },
    },
    include: {
      student: true,
      assignment: { include: { course: true, questions: { orderBy: { orderIndex: "asc" } } } },
      currentVersion: { include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } } },
      versions: {
        include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } },
        orderBy: { versionNumber: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    submissions: submissions.map((submission) => ({
      id: submission.id,
      status: submission.status,
      statusLabel: homeworkStatusLabel(submission.status, submission.assignment.dueAt),
      totalScore: submission.totalScore,
      overallComment: submission.overallComment,
      student: { id: submission.student.id, name: submission.student.name },
      assignment: {
        id: submission.assignment.id,
        title: submission.assignment.title,
        description: submission.assignment.description,
        dueAt: isoDate(submission.assignment.dueAt),
        course: { id: submission.assignment.course.id, name: submission.assignment.course.name },
        questionPreviewUrl: `/api/mobile/homework/files/question/${submission.assignment.id}?mode=preview`,
        questionDownloadUrl: `/api/mobile/homework/files/question/${submission.assignment.id}?mode=download`,
        answerDownloadUrl: `/api/mobile/homework/files/answer/${submission.assignment.id}?mode=download`,
        questions: submission.assignment.questions.map((question) => ({
          id: question.id,
          number: question.number,
          type: question.type,
          score: question.score,
        })),
      },
      currentVersion: submission.currentVersion ? {
        id: submission.currentVersion.id,
        versionNumber: submission.currentVersion.versionNumber,
        status: submission.currentVersion.status,
        totalScore: submission.currentVersion.totalScore,
        overallComment: submission.currentVersion.overallComment,
        submittedAt: isoDate(submission.currentVersion.submittedAt),
        previewUrl: `/api/mobile/homework/files/submission/${submission.currentVersion.id}?mode=preview`,
        downloadUrl: `/api/mobile/homework/files/submission/${submission.currentVersion.id}?mode=download`,
        reviews: submission.currentVersion.reviews.map((review) => ({
          id: review.id,
          score: review.score,
          comment: review.comment,
          isCorrect: review.isCorrect,
          question: {
            number: review.question.number,
            type: review.question.type,
            score: review.question.score,
          },
        })),
      } : null,
      versions: submission.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        totalScore: version.totalScore,
        overallComment: version.overallComment,
        submittedAt: isoDate(version.submittedAt),
        previewUrl: `/api/mobile/homework/files/submission/${version.id}?mode=preview`,
        downloadUrl: `/api/mobile/homework/files/submission/${version.id}?mode=download`,
      })),
    })),
  };
}
