import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

async function validateLearningLinkInput(data: any) {
  const workspaceId = String(data.workspaceId || "default-real");
  const parentId = String(data.parentId || "");
  const studentId = String(data.studentId || "");
  const teacherId = String(data.teacherId || "");
  const courseId = data.courseId ? String(data.courseId) : null;

  const [parent, teacher, student, course, parentStudent] = await Promise.all([
    prisma.user.findFirst({ where: { id: parentId, workspaceId, role: "parent" } }),
    prisma.user.findFirst({ where: { id: teacherId, workspaceId, role: "teacher" } }),
    prisma.student.findFirst({ where: { id: studentId, workspaceId } }),
    courseId ? prisma.course.findFirst({ where: { id: courseId, workspaceId } }) : Promise.resolve(null),
    prisma.parentStudent.findFirst({ where: { parentId, studentId } }),
  ]);

  if (!parent || !teacher || !student || (courseId && !course)) {
    return { error: "invalid learning link participants" };
  }
  if (!parentStudent) {
    return { error: "student is not visible to this parent" };
  }
  if (courseId) {
    const studentCourse = await prisma.studentCourse.findFirst({
      where: { workspaceId, studentId, courseId, status: "active" },
      select: { id: true },
    });
    if (!studentCourse) return { error: "student is not in this course" };
  }

  const subject = String(data.subject || teacher.teachingSubject || "数学").trim() || "数学";
  return { workspaceId, parent, teacher, student, courseId, subject };
}

/**
 * 回填该学生 learningLinkId 为 NULL 的历史学习数据到新创建的学习链接上。
 *
 * 背景：教师可能早于家长账号/学习链接创建考勤、成绩、知识点进度、薄弱点，
 * 这些数据会被写入 learningLinkId = NULL。一旦管理员为该学生建立学习链接，
 * 需要把旧数据关联过来，否则家长端只能看到 link 创建之后的数据。
 *
 * 注意 StudentKpProgress 上有 @@unique([learningLinkId, knowledgePointId])：
 * 若新 link 下已存在同知识点记录，则保留较优状态（mastered 优先，其次取更新时间），
 * 不能再简单 updateMany，否则会触发唯一键冲突。
 */
async function backfillLegacyLearningData(input: {
  workspaceId: string;
  studentId: string;
  learningLinkId: string;
}) {
  const { workspaceId, studentId, learningLinkId } = input;

  // 处理 kpProgress：先解决唯一键冲突，再批量回填
  const [legacyKpProgress, linkKpProgress] = await Promise.all([
    prisma.studentKpProgress.findMany({
      where: { workspaceId, studentId, learningLinkId: null },
      select: { id: true, knowledgePointId: true, status: true, updatedAt: true },
    }),
    prisma.studentKpProgress.findMany({
      where: { workspaceId, learningLinkId },
      select: { id: true, knowledgePointId: true, status: true, updatedAt: true },
    }),
  ]);
  const linkKpByKnowledgePoint = new Map(linkKpProgress.map((item) => [item.knowledgePointId, item]));

  const legacyIdsToDelete: string[] = [];
  const linkIdsToUpdate: { id: string; status: string; masteredAt: Date | null }[] = [];
  const legacyIdsToBackfill: string[] = [];

  for (const legacy of legacyKpProgress) {
    const existingOnLink = linkKpByKnowledgePoint.get(legacy.knowledgePointId);
    if (!existingOnLink) {
      legacyIdsToBackfill.push(legacy.id);
      continue;
    }
    // 冲突：合并状态。mastered 优先；否则取 updatedAt 较新的一方。
    const pickMastered =
      legacy.status === "mastered" || existingOnLink.status === "mastered";
    const preferLegacy =
      legacy.status === "mastered" && existingOnLink.status !== "mastered"
        ? true
        : legacy.status !== "mastered" && existingOnLink.status === "mastered"
          ? false
          : legacy.updatedAt.getTime() > existingOnLink.updatedAt.getTime();
    const nextStatus = pickMastered
      ? "mastered"
      : preferLegacy
        ? legacy.status
        : existingOnLink.status;
    linkIdsToUpdate.push({
      id: existingOnLink.id,
      status: nextStatus,
      masteredAt: nextStatus === "mastered" ? new Date() : null,
    });
    legacyIdsToDelete.push(legacy.id);
  }

  await prisma.$transaction([
    // 先删除会冲突的 legacy 行，腾出唯一键空间
    ...(legacyIdsToDelete.length > 0
      ? [prisma.studentKpProgress.deleteMany({ where: { id: { in: legacyIdsToDelete } } })]
      : []),
    // 更新 link 上已存在行的状态
    ...linkIdsToUpdate.map((item) =>
      prisma.studentKpProgress.update({
        where: { id: item.id },
        data: { status: item.status, masteredAt: item.masteredAt },
      }),
    ),
    // 把剩余 legacy 行回填到新 link
    ...(legacyIdsToBackfill.length > 0
      ? [
          prisma.studentKpProgress.updateMany({
            where: { id: { in: legacyIdsToBackfill } },
            data: { learningLinkId },
          }),
        ]
      : []),
    // 其余表没有类似唯一键冲突，直接回填
    prisma.weakPoint.updateMany({
      where: { workspaceId, studentId, learningLinkId: null },
      data: { learningLinkId },
    }),
    prisma.attendance.updateMany({
      where: { workspaceId, studentId, learningLinkId: null },
      data: { learningLinkId },
    }),
    prisma.exam.updateMany({
      where: { workspaceId, studentId, learningLinkId: null },
      data: { learningLinkId },
    }),
  ]);
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

  // 把该学生历史上 learningLinkId 为 NULL 的学习数据关联到新链接，
  // 避免家长端看不到 link 创建之前的考勤/成绩/知识点/薄弱点。
  await backfillLegacyLearningData({
    workspaceId: validated.workspaceId,
    studentId: validated.student.id,
    learningLinkId: learningLink.id,
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
