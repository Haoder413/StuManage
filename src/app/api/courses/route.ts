import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET() {
  const user = await requireTeacherLike();
  const courses = await prisma.course.findMany({
    where: { workspaceId: user.workspaceId },
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      _count: { select: { knowledgePoints: true, studentCourses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(courses);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const type = data.type === "custom" ? "custom" : "fixed";
  const scheduleTimes = Array.isArray(data.scheduleTimes)
    ? data.scheduleTimes
        .map((item: { dayOfWeek?: number; startTime?: string; endTime?: string }, index: number) => ({
          workspaceId: user.workspaceId,
          dayOfWeek: Number(item.dayOfWeek),
          startTime: String(item.startTime || ""),
          endTime: String(item.endTime || ""),
          orderIndex: index,
        }))
        .filter((item: { dayOfWeek: number; startTime: string; endTime: string }) =>
          Number.isInteger(item.dayOfWeek) && item.dayOfWeek >= 0 && item.dayOfWeek <= 6 && item.startTime && item.endTime
        )
    : [];

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        workspaceId: user.workspaceId,
        name: data.name,
        description: data.description || null,
        type,
        defaultCapacity: type === "custom" ? 1 : data.defaultCapacity ? Number(data.defaultCapacity) : null,
        scheduleTimes: scheduleTimes.length > 0 ? { create: scheduleTimes } : undefined,
      },
      include: { scheduleTimes: { orderBy: { orderIndex: "asc" } } },
    });

    if (type === "fixed" && scheduleTimes.length > 0) {
      await tx.schedule.createMany({
        data: scheduleTimes.map((time: { dayOfWeek: number; startTime: string; endTime: string }) => ({
          workspaceId: user.workspaceId,
          courseId: created.id,
          type: "fixed",
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
        })),
      });
    }

    return created;
  });
  return NextResponse.json(course, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id, workspaceId: user.workspaceId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.course.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  return NextResponse.json({ success: true });
}
