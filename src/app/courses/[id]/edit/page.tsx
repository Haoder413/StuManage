import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { CourseEditForm } from "./course-edit-form";

export default async function EditCoursePage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const course = await prisma.course.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      studentCourses: {
        where: { status: "active" },
        select: { studentId: true },
      },
    },
  });

  if (!course) notFound();
  if (course.status === "completed") notFound();

  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true, name: true, grade: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CourseEditForm
      course={{
        id: course.id,
        name: course.name,
        description: course.description,
        type: course.type,
        defaultCapacity: course.defaultCapacity,
        selectedStudentIds: Array.from(new Set(course.studentCourses.map((item) => item.studentId))),
        scheduleTimes: course.scheduleTimes.map((time) => ({
          dayOfWeek: time.dayOfWeek,
          startTime: time.startTime,
          endTime: time.endTime,
          startDate: time.startDate ? time.startDate.toISOString() : null,
          endDate: time.endDate ? time.endDate.toISOString() : null,
        })),
      }}
      students={students}
    />
  );
}
