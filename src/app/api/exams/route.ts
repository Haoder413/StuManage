import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const where = studentId ? { workspaceId: user.workspaceId, studentId } : { workspaceId: user.workspaceId };
  const groupByStudent = searchParams.get("groupBy") === "student";

  let exams;
  if (groupByStudent) {
    exams = await prisma.exam.findMany({
      where,
      include: { student: true },
      orderBy: { date: "desc" },
    });
  } else {
    exams = await prisma.exam.findMany({
      where,
      include: { student: true },
      orderBy: { date: "desc" },
      take: studentId ? undefined : 100,
    });
  }
  return NextResponse.json(exams);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const exam = await prisma.exam.create({
    data: {
      workspaceId: user.workspaceId,
      studentId: data.studentId,
      name: data.name,
      type: data.type,
      score: parseFloat(data.score),
      totalScore: parseFloat(data.totalScore) || 100,
      date: new Date(data.date),
      notes: data.notes || null,
    },
  });
  return NextResponse.json(exam, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const updateData: any = {};
  if (data.score !== undefined) updateData.score = parseFloat(data.score);
  if (data.totalScore !== undefined) updateData.totalScore = parseFloat(data.totalScore);
  if (data.name !== undefined) updateData.name = data.name;
  await prisma.exam.updateMany({
    where: { id: data.id, workspaceId: user.workspaceId },
    data: updateData,
  });
  const exam = await prisma.exam.findFirst({ where: { id: data.id, workspaceId: user.workspaceId } });
  if (!exam) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(exam);
}
