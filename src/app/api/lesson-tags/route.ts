import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function GET() {
  const user = await requireTeacherLike();
  const tags = await prisma.lessonTag.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  try {
    const tag = await prisma.lessonTag.create({
      data: { workspaceId: user.workspaceId, name: data.name, type: data.type },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "标签已存在" }, { status: 400 });
    throw e;
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireTeacherLike();
  const data = await request.json();
  await prisma.lessonTag.updateMany({
    where: { id: data.id, workspaceId: user.workspaceId },
    data: { name: data.name, type: data.type },
  });
  const tag = await prisma.lessonTag.findFirst({ where: { id: data.id, workspaceId: user.workspaceId } });
  if (!tag) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tag);
}

export async function DELETE(request: NextRequest) {
  const user = await requireTeacherLike();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await prisma.lessonTag.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  return NextResponse.json({ success: true });
}
