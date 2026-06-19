import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET() {
  const user = await requireTeacherLike();
  const progress = await prisma.studentKpProgress.findMany({
    where: { workspaceId: user.workspaceId },
    include: { student: true, knowledgePoint: true },
  });
  return NextResponse.json(progress);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const progress = await prisma.studentKpProgress.upsert({
    where: {
      studentId_knowledgePointId: {
        studentId: data.studentId,
        knowledgePointId: data.knowledgePointId,
      },
    },
    update: { status: data.status, masteredAt: data.status === "mastered" ? new Date() : null },
    create: {
      workspaceId: user.workspaceId,
      studentId: data.studentId,
      knowledgePointId: data.knowledgePointId,
      status: data.status || "not_started",
    },
  });
  return NextResponse.json(progress, { status: 201 });
}
