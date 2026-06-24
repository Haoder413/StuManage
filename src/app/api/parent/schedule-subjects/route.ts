import { NextRequest, NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeSubjectName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.slice(0, 20);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const user = await requireParent();
  const [subjects, scheduleSubjects] = await Promise.all([
    prisma.parentScheduleSubject.findMany({
      where: {
        workspaceId: user.workspaceId,
        parentId: user.id,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.parentScheduleItem.findMany({
      where: {
        workspaceId: user.workspaceId,
        parentId: user.id,
      },
      select: { subjectLabel: true },
      distinct: ["subjectLabel"],
      orderBy: { subjectLabel: "asc" },
    }),
  ]);

  const subjectByName = new Map(subjects.map((subject) => [subject.name, subject]));
  const visible = new Map<string, { id: string; name: string; source: "managed" | "schedule" }>();

  for (const subject of subjects) {
    if (subject.isActive) {
      visible.set(subject.name, { id: subject.id, name: subject.name, source: "managed" });
    }
  }

  for (const item of scheduleSubjects) {
    const name = normalizeSubjectName(item.subjectLabel);
    if (!name || subjectByName.get(name)?.isActive === false || visible.has(name)) continue;
    visible.set(name, { id: `schedule:${name}`, name, source: "schedule" });
  }

  return NextResponse.json({ subjects: [...visible.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")) });
}

export async function POST(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const name = normalizeSubjectName(data.name);
  if (!name) return jsonError("missing name", 400);

  const subject = await prisma.parentScheduleSubject.upsert({
    where: {
      workspaceId_parentId_name: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        name,
      },
    },
    create: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      name,
      isActive: true,
    },
    update: { isActive: true },
  });

  return NextResponse.json({ id: subject.id, name: subject.name, source: "managed" }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const oldName = normalizeSubjectName(data.oldName);
  const name = normalizeSubjectName(data.name);
  if (!oldName || !name) return jsonError("missing name", 400);

  const subject = await prisma.$transaction(async (tx) => {
    await tx.parentScheduleSubject.upsert({
      where: {
        workspaceId_parentId_name: {
          workspaceId: user.workspaceId,
          parentId: user.id,
          name: oldName,
        },
      },
      create: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        name: oldName,
        isActive: false,
      },
      update: { isActive: false },
    });

    const savedSubject = await tx.parentScheduleSubject.upsert({
      where: {
        workspaceId_parentId_name: {
          workspaceId: user.workspaceId,
          parentId: user.id,
          name,
        },
      },
      create: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        name,
        isActive: true,
      },
      update: { isActive: true },
    });

    await tx.parentScheduleItem.updateMany({
      where: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        subjectLabel: oldName,
      },
      data: { subjectLabel: name },
    });

    return savedSubject;
  });

  return NextResponse.json({ id: subject.id, name: subject.name, source: "managed" });
}

export async function DELETE(request: NextRequest) {
  const user = await requireParent();
  const { searchParams } = new URL(request.url);
  const name = normalizeSubjectName(searchParams.get("name"));
  if (!name) return jsonError("missing name", 400);

  await prisma.parentScheduleSubject.upsert({
    where: {
      workspaceId_parentId_name: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        name,
      },
    },
    create: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      name,
      isActive: false,
    },
    update: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
