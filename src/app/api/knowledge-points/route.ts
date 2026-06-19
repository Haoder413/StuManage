import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

async function collectChildIds(parentId: string, workspaceId: string): Promise<string[]> {
  const children = await prisma.knowledgePoint.findMany({
    where: { parentId, workspaceId },
    select: { id: true },
  });
  const nested = await Promise.all(children.map((child) => collectChildIds(child.id, workspaceId)));
  return [...children.map((child) => child.id), ...nested.flat()];
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (Array.isArray(data.items)) {
    const created = [];
    const tempIdToId = new Map<string, string>();
    for (const item of data.items) {
      const parentId = item.parentTempId ? tempIdToId.get(item.parentTempId) || null : null;
      const knowledgePoint = await prisma.knowledgePoint.create({
        data: {
          workspaceId: user.workspaceId,
          courseId: data.courseId,
          parentId,
          name: item.name,
          orderIndex: item.orderIndex,
        },
      });
      if (item.tempId) tempIdToId.set(item.tempId, knowledgePoint.id);
      created.push(knowledgePoint);
    }
    return NextResponse.json(created, { status: 201 });
  }

  const siblingCount = await prisma.knowledgePoint.count({
    where: { workspaceId: user.workspaceId, courseId: data.courseId, parentId: data.parentId || null },
  });
  const knowledgePoint = await prisma.knowledgePoint.create({
    data: {
      workspaceId: user.workspaceId,
      courseId: data.courseId,
      parentId: data.parentId || null,
      name: data.name,
      orderIndex: siblingCount + 1,
    },
  });
  return NextResponse.json(knowledgePoint, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  if (!data.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await prisma.knowledgePoint.updateMany({
    where: { id: data.id, workspaceId: user.workspaceId },
    data: {
      name: data.name,
    },
  });
  const knowledgePoint = await prisma.knowledgePoint.findFirst({ where: { id: data.id, workspaceId: user.workspaceId } });
  if (!knowledgePoint) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(knowledgePoint);
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const childIds = await collectChildIds(id, user.workspaceId);
  if (childIds.length > 0) {
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: childIds.reverse() }, workspaceId: user.workspaceId } });
  }
  await prisma.knowledgePoint.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  return NextResponse.json({ success: true });
}
