import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { ensureTeacherCanUseLearningLink, findLearningLinkForTeacherStudent } from "@/lib/learning-links";
import {
  teacherSeesAllWorkspaceData,
  teacherSubjectMatches,
  visibleProgressCourseWhere,
  visibleProgressStudentByIdWhere,
  visibleProgressStudentWhere,
} from "@/lib/teacher-visibility";
import { buildEffectiveProgressStatuses, calculateAncestorProgressUpdates } from "@/lib/knowledge-progress-tree";

function progressKey(studentId: string, knowledgePointId: string) {
  return `${studentId}:${knowledgePointId}`;
}

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const studentId = request.nextUrl.searchParams.get("studentId");
  const selectedCourseId = request.nextUrl.searchParams.get("courseId")?.trim() || null;
  if (selectedCourseId && !studentId) {
    return NextResponse.json({ error: "studentId is required when courseId is set" }, { status: 400 });
  }
  if (studentId) {
    const visibleStudent = await prisma.student.findFirst({
      where: visibleProgressStudentByIdWhere(user, studentId),
      select: { id: true },
    });
    if (!visibleStudent) {
      return NextResponse.json({ error: "student not found" }, { status: 404 });
    }
  }
  if (studentId && selectedCourseId) {
    const enrollment = await prisma.studentCourse.findFirst({
      where: {
        workspaceId: user.workspaceId,
        studentId,
        courseId: selectedCourseId,
        status: "active",
        course: visibleProgressCourseWhere(user),
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "course not found" }, { status: 404 });
    }
  }
  const studentWhere = studentId
    ? visibleProgressStudentByIdWhere(user, studentId)
    : visibleProgressStudentWhere(user);
  const courseWhere = {
    ...visibleProgressCourseWhere(user),
    ...(selectedCourseId ? { id: selectedCourseId } : {}),
  };
  const teacherLinks = await prisma.learningLink.findMany({
    where: {
      workspaceId: user.workspaceId,
      teacherId: user.id,
      isActive: true,
      ...(user.teachingSubject?.trim() ? { subject: user.teachingSubject.trim() } : {}),
    },
    select: { id: true },
  });
  const progress = await prisma.studentKpProgress.findMany({
    where: {
      workspaceId: user.workspaceId,
      student: studentWhere,
      knowledgePoint: { course: courseWhere },
      ...(teacherSeesAllWorkspaceData(user)
        ? {}
        : {
            OR: [
              { learningLinkId: { in: teacherLinks.map((link) => link.id) } },
              { learningLinkId: null },
            ],
          }),
    },
    select: {
      id: true,
      workspaceId: true,
      learningLinkId: true,
      studentId: true,
      knowledgePointId: true,
      status: true,
      masteredAt: true,
      updatedAt: true,
      student: { select: { id: true, name: true, grade: true, lessonFrequency: true } },
      knowledgePoint: {
        select: {
          id: true,
          name: true,
          parentId: true,
          orderIndex: true,
          courseId: true,
          course: { select: { id: true, name: true } },
        },
      },
    },
  });

  const progressKeys = new Set(progress.map((item) => progressKey(item.studentId, item.knowledgePointId)));
  const studentsWithCourseKnowledge = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      name: true,
      grade: true,
      lessonFrequency: true,
      studentCourses: {
        where: { status: "active", course: courseWhere },
        select: {
          course: {
            select: {
              id: true,
              name: true,
              knowledgePoints: {
                select: { id: true, name: true, parentId: true, orderIndex: true, courseId: true },
                orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  const syntheticProgress = studentsWithCourseKnowledge.flatMap((student) =>
    student.studentCourses.flatMap((studentCourse) =>
      studentCourse.course.knowledgePoints
        .filter((knowledgePoint) => !progressKeys.has(progressKey(student.id, knowledgePoint.id)))
        .map((knowledgePoint) => ({
          id: `synthetic-${student.id}-${knowledgePoint.id}`,
          workspaceId: user.workspaceId,
          learningLinkId: null,
          studentId: student.id,
          knowledgePointId: knowledgePoint.id,
          status: "not_started",
          masteredAt: null,
          updatedAt: new Date(0),
          student,
          knowledgePoint: {
            ...knowledgePoint,
            course: { id: studentCourse.course.id, name: studentCourse.course.name },
          },
        }))
    )
  );

  return NextResponse.json([...progress, ...syntheticProgress]);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const student = await prisma.student.findFirst({
    where: visibleProgressStudentByIdWhere(user, String(data.studentId || "")),
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
  const changedKnowledgePoint = await prisma.knowledgePoint.findFirst({
    where: {
      id: String(data.knowledgePointId || ""),
      workspaceId: user.workspaceId,
      course: visibleProgressCourseWhere(user),
    },
    select: { courseId: true },
  });
  if (!changedKnowledgePoint) {
    return NextResponse.json({ error: "knowledge point not found" }, { status: 404 });
  }
  const enrollment = await prisma.studentCourse.findFirst({
    where: {
      workspaceId: user.workspaceId,
      studentId: student.id,
      courseId: changedKnowledgePoint.courseId,
      status: "active",
      course: visibleProgressCourseWhere(user),
    },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "course not found" }, { status: 404 });
  }
  const learningLink = data.learningLinkId
    ? user.role === "teacher"
      ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
      : await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(
        user,
        String(data.studentId || ""),
        changedKnowledgePoint.courseId,
        user.role === "teacher" ? user.teachingSubject : null,
      );
  if (data.learningLinkId && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (learningLink && learningLink.studentId !== String(data.studentId || "")) {
    return NextResponse.json({ error: "learning link student mismatch" }, { status: 400 });
  }
  if (learningLink?.courseId && learningLink.courseId !== changedKnowledgePoint.courseId) {
    return NextResponse.json({ error: "learning link course mismatch" }, { status: 400 });
  }
  if (learningLink && !teacherSubjectMatches(user, learningLink.subject)) {
    return NextResponse.json({ error: "learning link subject mismatch" }, { status: 400 });
  }
  const existing = await prisma.studentKpProgress.findFirst({
    where: {
      workspaceId: user.workspaceId,
      knowledgePointId: data.knowledgePointId,
      ...(learningLink ? { learningLinkId: learningLink.id } : { studentId: data.studentId, learningLinkId: null }),
    },
  });
  const requestedStatus = data.status === "mastered" ? "mastered" : "learning";
  const progress = existing
    ? await prisma.studentKpProgress.update({
        where: { id: existing.id },
        data: { status: requestedStatus, masteredAt: requestedStatus === "mastered" ? new Date() : null },
      })
    : await prisma.studentKpProgress.create({
      data: {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
      studentId: learningLink?.studentId || data.studentId,
      knowledgePointId: data.knowledgePointId,
      status: requestedStatus,
      masteredAt: requestedStatus === "mastered" ? new Date() : null,
      },
    });
  const progressScope = learningLink
    ? { learningLinkId: learningLink.id }
    : { studentId: String(data.studentId || ""), learningLinkId: null };
  const [coursePoints, courseProgress] = await Promise.all([
    prisma.knowledgePoint.findMany({
      where: { workspaceId: user.workspaceId, courseId: changedKnowledgePoint.courseId },
      select: { id: true, parentId: true },
    }),
    prisma.studentKpProgress.findMany({
      where: {
        workspaceId: user.workspaceId,
        studentId: String(data.studentId || ""),
        knowledgePoint: { courseId: changedKnowledgePoint.courseId },
        ...(learningLink
          ? { OR: [{ learningLinkId: learningLink.id }, { learningLinkId: null }] }
          : { learningLinkId: null }),
      },
      select: { knowledgePointId: true, status: true, learningLinkId: true },
    }),
  ]);
  const statuses = buildEffectiveProgressStatuses(courseProgress, learningLink?.id || null);
  statuses[String(data.knowledgePointId)] = requestedStatus;
  const ancestorUpdates = calculateAncestorProgressUpdates(
    coursePoints,
    statuses,
    String(data.knowledgePointId),
  );

  for (const update of ancestorUpdates) {
    const existingAncestor = await prisma.studentKpProgress.findFirst({
      where: {
        workspaceId: user.workspaceId,
        knowledgePointId: update.knowledgePointId,
        ...progressScope,
      },
      select: { id: true },
    });
    if (existingAncestor) {
      await prisma.studentKpProgress.update({
        where: { id: existingAncestor.id },
        data: {
          status: update.status,
          masteredAt: update.status === "mastered" ? new Date() : null,
        },
      });
    } else {
      await prisma.studentKpProgress.create({
        data: {
          workspaceId: user.workspaceId,
          learningLinkId: learningLink?.id || null,
          studentId: learningLink?.studentId || String(data.studentId || ""),
          knowledgePointId: update.knowledgePointId,
          status: update.status,
          masteredAt: update.status === "mastered" ? new Date() : null,
        },
      });
    }
  }

  return NextResponse.json({ ...progress, ancestorUpdates }, { status: 201 });
}
