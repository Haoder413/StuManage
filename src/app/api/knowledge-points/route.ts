import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { visibleCourseByIdWhere, visibleCourseWhere } from "@/lib/teacher-visibility";

async function collectChildIds(parentId: string, workspaceId: string): Promise<string[]> {
  const children = await prisma.knowledgePoint.findMany({
    where: { parentId, workspaceId },
    select: { id: true },
  });
  const nested = await Promise.all(children.map((child) => collectChildIds(child.id, workspaceId)));
  return [...children.map((child) => child.id), ...nested.flat()];
}

async function deleteKnowledgePoints(ids: string[], workspaceId: string) {
  const rootIds = Array.from(new Set(ids.filter(Boolean)));
  const nestedIds = (await Promise.all(rootIds.map((id) => collectChildIds(id, workspaceId)))).flat();
  const childIds = Array.from(new Set(nestedIds));

  if (childIds.length > 0) {
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: childIds.reverse() }, workspaceId } });
  }
  if (rootIds.length > 0) {
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: rootIds }, workspaceId } });
  }

  return { deletedIds: Array.from(new Set([...rootIds, ...childIds])) };
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  const course = await prisma.course.findFirst({
    where: visibleCourseByIdWhere(user, String(data.courseId || "")),
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "course not found" }, { status: 404 });
  if (Array.isArray(data.items)) {
    const created = [];
    const tempIdToId = new Map<string, string>();
    for (const item of data.items) {
      const parentId = item.parentTempId ? tempIdToId.get(item.parentTempId) || null : null;
      const knowledgePoint = await prisma.knowledgePoint.create({
        data: {
          workspaceId: user.workspaceId,
          courseId: course.id,
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
    where: { workspaceId: user.workspaceId, courseId: course.id, parentId: data.parentId || null },
  });
  const knowledgePoint = await prisma.knowledgePoint.create({
    data: {
      workspaceId: user.workspaceId,
      courseId: course.id,
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
  const editable = await prisma.knowledgePoint.findFirst({
    where: { id: data.id, workspaceId: user.workspaceId, course: visibleCourseWhere(user) },
    select: { id: true },
  });
  if (!editable) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.knowledgePoint.updateMany({
    where: { id: editable.id, workspaceId: user.workspaceId },
    data: {
      name: data.name,
    },
  });
  const knowledgePoint = await prisma.knowledgePoint.findFirst({ where: { id: editable.id, workspaceId: user.workspaceId } });
  if (!knowledgePoint) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(knowledgePoint);
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const data = await request.json().catch(() => ({}));
  const ids = Array.isArray(data.ids)
    ? data.ids.map((item: unknown) => String(item || "")).filter(Boolean)
    : id
      ? [id]
      : [];
  if (ids.length === 0) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const visibleKnowledgePoints = await prisma.knowledgePoint.findMany({
    where: { id: { in: ids }, workspaceId: user.workspaceId, course: visibleCourseWhere(user) },
    select: { id: true },
  });
  if (visibleKnowledgePoints.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await deleteKnowledgePoints(visibleKnowledgePoints.map((item) => item.id), user.workspaceId);
  return NextResponse.json({ success: true, ...result });
}
