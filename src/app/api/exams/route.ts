import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import {
  ensureParentCanUseLearningLink,
  ensureTeacherCanUseLearningLink,
  findLearningLinkForTeacherStudent,
} from "@/lib/learning-links";
import { visibleStudentByIdWhere, visibleStudentWhere } from "@/lib/teacher-visibility";
import { applyExamWeakPoints, normalizeWeakPointDescriptions } from "@/lib/weak-point-reuse";

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const reviewStatus = searchParams.get("reviewStatus");
  const includeSubmissions = searchParams.get("includeSubmissions") === "true";
  const groupByStudent = searchParams.get("groupBy") === "student";
  const baseWhere: any = {
    workspaceId: user.workspaceId,
    ...(studentId ? { studentId } : {}),
    ...(reviewStatus ? { reviewStatus } : includeSubmissions ? {} : { reviewStatus: "approved" }),
  };

  if (user.role === "parent") {
    const links = await prisma.learningLink.findMany({
      where: { workspaceId: user.workspaceId, parentId: user.id, isActive: true },
      select: { id: true },
    });
    baseWhere.learningLinkId = { in: links.map((link) => link.id) };
  } else if (user.role === "teacher") {
    const links = await prisma.learningLink.findMany({
      where: { workspaceId: user.workspaceId, teacherId: user.id, isActive: true },
      select: { id: true },
    });
    const linkIds = links.map((link) => link.id);
    baseWhere.OR = [
      { learningLinkId: { in: linkIds } },
      { learningLinkId: null },
    ];
    baseWhere.student = visibleStudentWhere(user);
  } else if (user.role !== "admin" && user.role !== "demo") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let exams;
  if (groupByStudent) {
    exams = await prisma.exam.findMany({
      where: baseWhere,
      include: { student: true, learningLink: { include: { teacher: true, parent: true } } },
      orderBy: { date: "desc" },
    });
  } else {
    exams = await prisma.exam.findMany({
      where: baseWhere,
      include: { student: true, learningLink: { include: { teacher: true, parent: true } } },
      orderBy: { date: "desc" },
      take: studentId ? undefined : 100,
    });
  }
  return NextResponse.json(exams);
}

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const data = await request.json();
  const isParentSubmission = user.role === "parent";
  const isTeacherSubmission = user.role === "teacher" || user.role === "admin" || user.role === "demo";
  if (!isParentSubmission && !isTeacherSubmission) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const learningLink = isParentSubmission
    ? await ensureParentCanUseLearningLink(user, String(data.learningLinkId || ""))
    : data.learningLinkId
      ? user.role === "teacher"
        ? await ensureTeacherCanUseLearningLink(user, String(data.learningLinkId))
        : await prisma.learningLink.findFirst({
            where: { id: String(data.learningLinkId), workspaceId: user.workspaceId, isActive: true },
            include: { parent: true, teacher: true, student: true, course: true },
          })
      : await findLearningLinkForTeacherStudent(user, String(data.studentId || ""));

  if (isParentSubmission && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (data.learningLinkId && isTeacherSubmission && !learningLink) {
    return NextResponse.json({ error: "invalid learning link" }, { status: 400 });
  }
  if (isTeacherSubmission) {
    const teacherStudentId = learningLink?.studentId || String(data.studentId || "");
    const student = await prisma.student.findFirst({
      where: visibleStudentByIdWhere(user, teacherStudentId),
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
  }

  const reviewStatus = isParentSubmission ? "pending_review" : "approved";
  const examDate = new Date(data.date);
  const weakPointDescriptions = normalizeWeakPointDescriptions(data.weakPointDescriptions);
  const exam = await prisma.$transaction(async (tx) => {
    const savedExam = await tx.exam.create({
      data: {
        workspaceId: user.workspaceId,
        learningLinkId: learningLink?.id || null,
        studentId: learningLink?.studentId || data.studentId,
        name: data.name,
        type: data.type,
        score: parseFloat(data.score),
        totalScore: parseFloat(data.totalScore) || 100,
        date: examDate,
        notes: data.notes || null,
        reviewStatus,
        submittedById: user.id,
        reviewedById: reviewStatus === "approved" ? user.id : null,
        reviewedAt: reviewStatus === "approved" ? new Date() : null,
      },
    });

    if (reviewStatus === "approved" && learningLink && weakPointDescriptions.length > 0) {
      await applyExamWeakPoints({
        tx,
        workspaceId: user.workspaceId,
        learningLinkId: learningLink.id,
        studentId: learningLink.studentId,
        descriptions: weakPointDescriptions,
      });
    }

    return savedExam;
  });

  return NextResponse.json(exam, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireCurrentUser();
  if (user.role !== "teacher" && user.role !== "admin" && user.role !== "demo") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const data = await request.json();
  const updateData: any = {};
  if (data.score !== undefined) updateData.score = parseFloat(data.score);
  if (data.totalScore !== undefined) updateData.totalScore = parseFloat(data.totalScore);
  if (data.name !== undefined) updateData.name = String(data.name || "").trim();
  if (data.type !== undefined) updateData.type = data.type;
  const editableExam = await prisma.exam.findFirst({
    where: { id: data.id, workspaceId: user.workspaceId, student: visibleStudentWhere(user) },
    select: { id: true },
  });
  if (!editableExam) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.exam.updateMany({
    where: { id: editableExam.id, workspaceId: user.workspaceId },
    data: updateData,
  });
  const exam = await prisma.exam.findFirst({ where: { id: editableExam.id, workspaceId: user.workspaceId } });
  if (!exam) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(exam);
}
