import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { canManageHomework } from "@/lib/homework-access";

type QuestionInput = {
  id?: string;
  number?: string;
  type?: string;
  score?: number | string;
  standardAnswer?: string;
  explanation?: string;
};

async function getAssignment(id: string, workspaceId: string) {
  return prisma.homeworkAssignment.findFirst({
    where: { id, workspaceId },
    include: {
      course: true,
      questions: { orderBy: { orderIndex: "asc" } },
      submissions: {
        include: {
          student: true,
          currentVersion: {
            include: {
              reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } },
            },
          },
          versions: {
            include: {
              reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } },
            },
            orderBy: { versionNumber: "desc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const assignment = await getAssignment(params.id, user.workspaceId);
  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(assignment);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  if (!canManageHomework(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json();
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: { questions: true },
  });
  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (body.action === "save-questions") {
    const questions = Array.isArray(body.questions) ? body.questions as QuestionInput[] : [];
    await prisma.$transaction(async (tx) => {
      await tx.homeworkQuestion.deleteMany({ where: { workspaceId: user.workspaceId, assignmentId: assignment.id } });
      for (const [index, question] of questions.entries()) {
        await tx.homeworkQuestion.create({
          data: {
            workspaceId: user.workspaceId,
            assignmentId: assignment.id,
            number: String(question.number || index + 1),
            type: String(question.type || "其他"),
            score: Number(question.score || 0),
            standardAnswer: String(question.standardAnswer || "").trim() || null,
            explanation: String(question.explanation || "").trim() || null,
            orderIndex: index,
          },
        });
      }
      await tx.homeworkAssignment.update({
        where: { id: assignment.id },
        data: { recognitionStatus: "completed" },
      });
    });
    const updated = await getAssignment(params.id, user.workspaceId);
    return NextResponse.json(updated);
  }

  if (body.action === "publish") {
    const activeLinks = await prisma.studentCourse.findMany({
      where: { workspaceId: user.workspaceId, courseId: assignment.courseId, status: "active" },
      select: { studentId: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.homeworkAssignment.update({ where: { id: assignment.id }, data: { status: "published" } });
      for (const link of activeLinks) {
        await tx.homeworkSubmission.upsert({
          where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: link.studentId } },
          create: {
            workspaceId: user.workspaceId,
            assignmentId: assignment.id,
            studentId: link.studentId,
            status: "pending",
          },
          update: {},
        });
      }
    });
    const updated = await getAssignment(params.id, user.workspaceId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  if (!canManageHomework(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.homeworkAssignment.delete({ where: { id: assignment.id } });
  return NextResponse.json({ ok: true });
}
