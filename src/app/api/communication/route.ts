import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const where = studentId ? { workspaceId: user.workspaceId, studentId } : { workspaceId: user.workspaceId };
  const logs = await prisma.communicationLog.findMany({
    where,
    include: { student: true },
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const log = await prisma.communicationLog.create({
    data: {
      workspaceId: user.workspaceId,
      studentId: data.studentId,
      method: data.method,
      content: data.content,
      date: new Date(data.date),
    },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await prisma.communicationLog.updateMany({
    where: { id: data.id, workspaceId: user.workspaceId },
    data: {
      method: data.method,
      content: data.content,
      date: data.date ? new Date(data.date) : undefined,
    },
  });
  const log = await prisma.communicationLog.findFirst({ where: { id: data.id, workspaceId: user.workspaceId } });
  if (!log) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(log);
}
