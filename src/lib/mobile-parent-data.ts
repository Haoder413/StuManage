import { getParentStudents, parseTags } from "@/lib/parent-data";
import { prisma } from "@/lib/prisma";
import { canAccessResource, getVisibleResourceWhere } from "@/lib/resource-access";
import { getStageLabel } from "@/lib/review-scheduler";

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
      const learningCount = student.kpProgress.filter((item) => item.status === "learning").length;
      const activeWeakPoints = student.weakPoints.filter((point) => point.status === "active");
      const pendingWeakPoints = student.weakPoints.filter((point) => point.reviewSchedules.some((schedule) => schedule.status === "pending"));
      const masteredWeakPoints = student.weakPoints.filter((point) => point.status !== "active");
      const consolidatingWeakPoints = masteredWeakPoints.filter((point) => point.reviewSchedules.some((schedule) => schedule.status === "pending"));
      const completedWeakPoints = masteredWeakPoints.filter((point) => !point.reviewSchedules.some((schedule) => schedule.status === "pending"));
      return {
        id: student.id,
        name: student.name,
        totalKps,
        masteredCount,
        learningCount,
        currentWeakPointCount: activeWeakPoints.length,
        pendingWeakPointCount: pendingWeakPoints.length,
        consolidatingWeakPointCount: consolidatingWeakPoints.length,
        completedWeakPointCount: completedWeakPoints.length,
        progressPercent: totalKps > 0 ? Math.round((masteredCount / totalKps) * 100) : 0,
        knowledgePoints: student.kpProgress.map((item) => ({
          id: item.id,
          name: item.knowledgePoint.name,
          status: item.status,
        })),
        weakPoints: student.weakPoints.map((point) => {
          const pendingReview = point.reviewSchedules.find((schedule) => schedule.status === "pending");
          const completedReviewCount = point.reviewSchedules.filter((schedule) => schedule.status === "completed").length;
          const lastReviewed = point.reviewSchedules
            .filter((schedule) => schedule.lastReviewedAt)
            .sort((a, b) => new Date(b.lastReviewedAt || "").getTime() - new Date(a.lastReviewedAt || "").getTime())[0];
          return {
            id: point.id,
            description: point.description,
            status: point.status,
            statusLabel: point.status === "active" ? "当前薄弱" : pendingReview ? "巩固中" : "已完成",
            createdAt: isoDate(point.createdAt),
            masteredAt: isoDate(point.masteredAt),
            completedReviewCount,
            lastReviewedAt: isoDate(lastReviewed?.lastReviewedAt),
            nextReviewAt: isoDate(pendingReview?.nextReviewAt),
            reviewStage: pendingReview?.stage || null,
            reviewStageLabel: pendingReview ? getStageLabel(pendingReview.stage) : null,
          };
        }),
      };
    }),
  };
}

export async function getMobileResources(user: MobileParentUser) {
  const resources = await prisma.learningResource.findMany({
    where: getVisibleResourceWhere(user),
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items = await Promise.all(resources.map(async (resource) => {
    const canPreview = await canAccessResource(user, resource, "preview");
    const canDownload = await canAccessResource(user, resource, "download");
    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      resourceKind: resource.resourceKind,
      subject: resource.subject,
      grade: resource.grade,
      keywords: resource.keywords,
      fileName: resource.fileName,
      extension: resource.extension,
      size: resource.size,
      uploadedByName: resource.uploadedBy.name,
      createdAt: isoDate(resource.createdAt),
      canPreview,
      canDownload,
      previewUrl: canPreview ? `/api/resources/${resource.id}/file?mode=preview` : null,
      downloadUrl: canDownload ? `/api/resources/${resource.id}/file?mode=download` : null,
    };
  }));

  return { resources: items };
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
