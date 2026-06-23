import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

async function validateLearningLinkInput(data: any) {
  const workspaceId = String(data.workspaceId || "default-real");
  const parentId = String(data.parentId || "");
  const studentId = String(data.studentId || "");
  const teacherId = String(data.teacherId || "");
  const courseId = data.courseId ? String(data.courseId) : null;

  const [parent, teacher, student, course] = await Promise.all([
    prisma.user.findFirst({ where: { id: parentId, workspaceId, role: "parent" } }),
    prisma.user.findFirst({ where: { id: teacherId, workspaceId, role: "teacher" } }),
    prisma.student.findFirst({ where: { id: studentId, workspaceId } }),
    courseId ? prisma.course.findFirst({ where: { id: courseId, workspaceId } }) : Promise.resolve(null),
  ]);

  if (!parent || !teacher || !student || (courseId && !course)) {
    return { error: "invalid learning link participants" };
  }

  const subject = String(data.subject || teacher.teachingSubject || "数学").trim() || "数学";
  return { workspaceId, parent, teacher, student, courseId, subject };
}

export async function GET() {
  await requireAdmin();
  const learningLinks = await prisma.learningLink.findMany({
    include: {
      parent: true,
      teacher: true,
      student: true,
      course: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json(learningLinks);
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const data = await request.json();
  const validated = await validateLearningLinkInput(data);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const learningLink = await prisma.learningLink.create({
    data: {
      workspaceId: validated.workspaceId,
      parentId: validated.parent.id,
      studentId: validated.student.id,
      teacherId: validated.teacher.id,
      courseId: validated.courseId,
      subject: validated.subject,
      isActive: data.isActive !== false,
    },
    include: {
      parent: true,
      teacher: true,
      student: true,
      course: true,
    },
  });

  return NextResponse.json(learningLink, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  await requireAdmin();
  const data = await request.json();
  const id = String(data.id || "");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const validated = await validateLearningLinkInput(data);
  if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });

  const learningLink = await prisma.learningLink.update({
    where: { id },
    data: {
      workspaceId: validated.workspaceId,
      parentId: validated.parent.id,
      studentId: validated.student.id,
      teacherId: validated.teacher.id,
      courseId: validated.courseId,
      subject: validated.subject,
      isActive: data.isActive !== false,
    },
    include: {
      parent: true,
      teacher: true,
      student: true,
      course: true,
    },
  });

  return NextResponse.json(learningLink);
}
