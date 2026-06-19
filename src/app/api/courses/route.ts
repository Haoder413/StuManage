import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET() {
  const user = await requireTeacherLike();
  const courses = await prisma.course.findMany({
    where: { workspaceId: user.workspaceId },
    include: { _count: { select: { knowledgePoints: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const course = await prisma.course.create({
    data: {
      workspaceId: user.workspaceId,
      name: data.name,
      description: data.description || null,
      type: data.type || "fixed",
    },
  });
  return NextResponse.json(course, { status: 201 });
}
