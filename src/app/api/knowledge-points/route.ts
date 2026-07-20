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
    select: { id: true, courseId: true },
  });
  if (!editable) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 仅重命名
  if (typeof data.name === "string" && data.name.trim() && !("parentId" in data) && !Array.isArray(data.orderedIds)) {
    await prisma.knowledgePoint.updateMany({
      where: { id: editable.id, workspaceId: user.workspaceId },
      data: { name: data.name.trim() },
    });
    const renamed = await prisma.knowledgePoint.findFirst({ where: { id: editable.id, workspaceId: user.workspaceId } });
    if (!renamed) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(renamed);
  }

  // 移动 / 重排
  const parentId = typeof data.parentId === "string" && data.parentId ? data.parentId : null;
  if (parentId) {
    if (parentId === editable.id) {
      return NextResponse.json({ error: "cannot move into itself" }, { status: 400 });
    }
    // 目标父级必须是同课程、可见的知识点，且不能是被拖节点的子孙（防循环）
    const childIds = await collectChildIds(editable.id, user.workspaceId);
    if (childIds.includes(parentId)) {
      return NextResponse.json({ error: "cannot move into own descendant" }, { status: 400 });
    }
    const parent = await prisma.knowledgePoint.findFirst({
      where: { id: parentId, workspaceId: user.workspaceId, courseId: editable.courseId, course: visibleCourseWhere(user) },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: "parent not found" }, { status: 404 });
  }

  if (Array.isArray(data.orderedIds) && data.orderedIds.length > 0) {
    // 批量重排：把 orderedIds 全部设为同一 parentId，按位次写 orderIndex
    const ids = data.orderedIds.map((item: unknown) => String(item || "")).filter(Boolean);
    const visible = await prisma.knowledgePoint.findMany({
      where: { id: { in: ids }, workspaceId: user.workspaceId, courseId: editable.courseId, course: visibleCourseWhere(user) },
      select: { id: true },
    });
    const visibleIds = new Set(visible.map((item) => item.id));
    await prisma.$transaction(
      ids
        .filter((id: string) => visibleIds.has(id))
        .map((id: string, idx: number) =>
          prisma.knowledgePoint.updateMany({
            where: { id, workspaceId: user.workspaceId },
            data: { parentId, orderIndex: idx + 1 },
          })
        )
    );
    const refreshed = await prisma.knowledgePoint.findMany({
      where: { workspaceId: user.workspaceId, courseId: editable.courseId },
      orderBy: [{ orderIndex: "asc" }],
    });
    return NextResponse.json(refreshed);
  }

  // 兼容：单点 parentId + orderIndex
  await prisma.knowledgePoint.updateMany({
    where: { id: editable.id, workspaceId: user.workspaceId },
    data: {
      parentId,
      ...(typeof data.orderIndex === "number" && Number.isFinite(data.orderIndex)
        ? { orderIndex: Math.max(0, Math.floor(data.orderIndex)) }
        : {}),
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
