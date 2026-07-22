import { NextRequest, NextResponse } from "next/server";
import { requireTeacherLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortTeacherProgressCourses } from "@/lib/teacher-progress";
import {
  teacherSeesAllWorkspaceData,
  visibleProgressCourseWhere,
  visibleProgressStudentByIdWhere,
} from "@/lib/teacher-visibility";

export async function GET(request: NextRequest) {
  const user = await requireTeacherLike();
  const studentId = request.nextUrl.searchParams.get("studentId")?.trim() || "";
  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: visibleProgressStudentByIdWhere(user, studentId),
    select: {
      id: true,
      studentCourses: {
        where: { status: "active", course: visibleProgressCourseWhere(user) },
        select: {
          course: { select: { id: true, name: true, updatedAt: true } },
        },
      },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }

  const courseIds = student.studentCourses.map((item) => item.course.id);
  const progress = courseIds.length === 0
    ? []
    : await prisma.studentKpProgress.findMany({
        where: {
          workspaceId: user.workspaceId,
          studentId,
          knowledgePoint: { courseId: { in: courseIds } },
          ...(teacherSeesAllWorkspaceData(user)
            ? {}
            : {
                OR: [
                  {
                    learningLink: {
                      workspaceId: user.workspaceId,
                      teacherId: user.id,
                      isActive: true,
                      ...(user.teachingSubject?.trim() ? { subject: user.teachingSubject.trim() } : {}),
                    },
                  },
                  { learningLinkId: null },
                ],
              }),
        },
        select: {
          updatedAt: true,
          knowledgePoint: { select: { courseId: true } },
        },
      });

  const lastProgressByCourse = new Map<string, Date>();
  for (const row of progress) {
    const courseId = row.knowledgePoint.courseId;
    const existing = lastProgressByCourse.get(courseId);
    if (!existing || row.updatedAt > existing) lastProgressByCourse.set(courseId, row.updatedAt);
  }

  const courses = sortTeacherProgressCourses(student.studentCourses.map(({ course }) => ({
    ...course,
    lastProgressAt: lastProgressByCourse.get(course.id) ?? null,
  })));

  return NextResponse.json({ viewerId: user.id, courses });
}
