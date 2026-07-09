import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { ensureTeacherCanUseLearningLink, findLearningLinkForTeacherStudent } from "@/lib/learning-links";
import { teacherSeesAllWorkspaceData, visibleStudentByIdWhere, visibleStudentWhere } from "@/lib/teacher-visibility";

function progressKey(studentId: string, knowledgePointId: string, learningLinkId: string | null) {
  return `${studentId}:${knowledgePointId}:${learningLinkId || "legacy"}`;
}

export async function GET() {
  const user = await requireTeacherLike();
  const teacherLinks = await prisma.learningLink.findMany({
    where: { workspaceId: user.workspaceId, teacherId: user.id, isActive: true },
    select: { id: true },
  });
  const progress = await prisma.studentKpProgress.findMany({
    where: {
      workspaceId: user.workspaceId,
      student: visibleStudentWhere(user),
      ...(teacherSeesAllWorkspaceData(user)
        ? {}
        : {
            OR: [
              { learningLinkId: { in: teacherLinks.map((link) => link.id) } },
              { learningLinkId: null },
            ],
          }),
    },
    include: {
      student: true,
      knowledgePoint: { include: { course: { select: { id: true, name: true } } } },
    },
  });

  const progressKeys = new Set(progress.map((item) => progressKey(item.studentId, item.knowledgePointId, item.learningLinkId)));
  const studentsWithCourseKnowledge = await prisma.student.findMany({
    where: visibleStudentWhere(user),
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
    },
  });

  const syntheticProgress = studentsWithCourseKnowledge.flatMap((student) =>
    student.studentCourses.flatMap((studentCourse) =>
      studentCourse.course.knowledgePoints
        .filter((knowledgePoint) => !progressKeys.has(progressKey(student.id, knowledgePoint.id, null)))
        .map((knowledgePoint) => ({
          id: `synthetic-${student.id}-${knowledgePoint.id}`,
          workspaceId: user.workspaceId,
          learningLinkId: null,
          studentId: student.id,
          knowledgePointId: knowledgePoint.id,
          status: "learning",
          masteredAt: null,
          updatedAt: new Date(0),
          student,
          knowledgePoint: {
            ...knowledgePoint,
            course: studentCourse.course,
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
    where: visibleStudentByIdWhere(user, String(data.studentId || "")),
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
  const learningLink = data.learningLinkId
    ? user.role === "teacher"
      ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
      : await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  if (data.learningLinkId && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (learningLink && learningLink.studentId !== String(data.studentId || "")) {
    return NextResponse.json({ error: "learning link student mismatch" }, { status: 400 });
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
  return NextResponse.json(progress, { status: 201 });
}
