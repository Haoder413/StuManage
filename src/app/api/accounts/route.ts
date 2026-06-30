import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

function cleanOptional(value: unknown) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

async function ensureStudentsInWorkspace(studentIds: string[], workspaceId: string) {
  if (studentIds.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, workspaceId },
    select: { id: true },
  });
  return students.map((student) => student.id);
}

export async function GET() {
  await requireAdmin();
  const [users, workspaces, students] = await Promise.all([
    prisma.user.findMany({
      include: {
        workspace: true,
        parentStudents: { include: { student: true } },
        learningLinksAsParent: { include: { student: true, teacher: true, course: true } },
        learningLinksAsTeacher: { include: { student: true, parent: true, course: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workspace.findMany({ orderBy: { name: "asc" } }),
    prisma.student.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ users, workspaces, students });
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const data = await request.json();
  const role = String(data.role || "parent");
  const workspaceId = String(data.workspaceId || "default-real");
  const parentStudentIds = Array.isArray(data.parentStudentIds)
    ? data.parentStudentIds.map(String)
    : [];
  const visibleStudentIds = role === "parent"
    ? await ensureStudentsInWorkspace(parentStudentIds, workspaceId)
    : [];

  const user = await prisma.user.create({
    data: {
      workspaceId,
      name: String(data.name || "").trim(),
      phone: cleanOptional(data.phone),
      email: cleanOptional(data.email),
      role,
      teachingSubject: role === "teacher" ? cleanOptional(data.teachingSubject) || "数学" : null,
      passwordHash: hashPassword(String(data.password || "123456")),
      parentStudents: visibleStudentIds.length > 0
        ? {
            createMany: {
              data: visibleStudentIds.map((studentId) => ({ studentId })),
            },
          }
        : undefined,
    },
    include: {
      workspace: true,
      parentStudents: { include: { student: true } },
      learningLinksAsParent: { include: { student: true, teacher: true, course: true } },
      learningLinksAsTeacher: { include: { student: true, parent: true, course: true } },
    },
  });

  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  await requireAdmin();
  const data = await request.json();
  const id = String(data.id || "");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const role = String(data.role || "parent");
  const workspaceId = String(data.workspaceId || "default-real");
  const parentStudentIds = Array.isArray(data.parentStudentIds)
    ? data.parentStudentIds.map(String)
    : [];
  const visibleStudentIds = role === "parent"
    ? await ensureStudentsInWorkspace(parentStudentIds, workspaceId)
    : [];

  await prisma.user.update({
    where: { id },
    data: {
      workspaceId,
      name: String(data.name || "").trim(),
      phone: cleanOptional(data.phone),
      email: cleanOptional(data.email),
      role,
      teachingSubject: role === "teacher" ? cleanOptional(data.teachingSubject) || "数学" : null,
      passwordHash: data.password ? hashPassword(String(data.password)) : undefined,
      parentStudents: {
        deleteMany: {},
        createMany: {
          data: visibleStudentIds.map((studentId) => ({ studentId })),
        },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      workspace: true,
      parentStudents: { include: { student: true } },
      learningLinksAsParent: { include: { student: true, teacher: true, course: true } },
      learningLinksAsTeacher: { include: { student: true, parent: true, course: true } },
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(request: NextRequest) {
  const currentUser = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (id === currentUser.id) {
    return NextResponse.json({ error: "cannot delete current account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "account has historical records and cannot be deleted" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
