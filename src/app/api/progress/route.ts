import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { findLearningLinkForTeacherStudent } from "@/lib/learning-links";

export async function GET() {
  const user = await requireTeacherLike();
  const teacherLinks = await prisma.learningLink.findMany({
    where: { workspaceId: user.workspaceId, teacherId: user.id, isActive: true },
    select: { id: true },
  });
  const progress = await prisma.studentKpProgress.findMany({
    where: {
      workspaceId: user.workspaceId,
      OR: [
        { learningLinkId: { in: teacherLinks.map((link) => link.id) } },
        { learningLinkId: null },
      ],
    },
    include: { student: true, knowledgePoint: true },
  });

  const progressKeys = new Set(progress.map((item) => `${item.studentId}:${item.knowledgePointId}`));
  const studentsWithCourseKnowledge = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
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
        .filter((knowledgePoint) => !progressKeys.has(`${student.id}:${knowledgePoint.id}`))
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
          knowledgePoint,
        }))
    )
  );

  return NextResponse.json([...progress, ...syntheticProgress]);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const learningLink = data.learningLinkId
    ? await prisma.learningLink.findFirst({ where: { id: String(data.learningLinkId), workspaceId: user.workspaceId } })
    : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));
  const existing = await prisma.studentKpProgress.findFirst({
    where: {
      workspaceId: user.workspaceId,
      knowledgePointId: data.knowledgePointId,
      ...(learningLink ? { learningLinkId: learningLink.id } : { studentId: data.studentId, learningLinkId: null }),
    },
  });
  const progress = existing
    ? await prisma.studentKpProgress.update({
        where: { id: existing.id },
        data: { status: data.status, masteredAt: data.status === "mastered" ? new Date() : null },
      })
    : await prisma.studentKpProgress.create({
      data: {
      workspaceId: user.workspaceId,
      learningLinkId: learningLink?.id || null,
      studentId: data.studentId,
      knowledgePointId: data.knowledgePointId,
      status: data.status || "not_started",
      },
    });
  return NextResponse.json(progress, { status: 201 });
}
