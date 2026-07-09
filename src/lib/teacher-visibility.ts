import type { Prisma } from "@prisma/client";

export type TeacherVisibilityUser = {
  id: string;
  workspaceId: string;
  role: string;
};

export function teacherSeesAllWorkspaceData(user: TeacherVisibilityUser) {
  return user.role === "admin" || user.role === "demo";
}

export function visibleStudentWhere(user: TeacherVisibilityUser): Prisma.StudentWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      { createdById: user.id },
      {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
          },
        },
      },
    ],
  };
}

export function visibleStudentByIdWhere(user: TeacherVisibilityUser, studentId: string): Prisma.StudentWhereInput {
  return {
    id: studentId,
    ...visibleStudentWhere(user),
  };
}

export function deletableStudentByIdWhere(user: TeacherVisibilityUser, studentId: string): Prisma.StudentWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { id: studentId, workspaceId: user.workspaceId };
  }

  return {
    id: studentId,
    workspaceId: user.workspaceId,
    createdById: user.id,
  };
}

export function canDeleteStudent(user: TeacherVisibilityUser, student: { createdById: string | null }) {
  return teacherSeesAllWorkspaceData(user) || student.createdById === user.id;
}

export function visibleCourseWhere(user: TeacherVisibilityUser): Prisma.CourseWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      { createdById: user.id },
      {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
          },
        },
      },
      {
        studentCourses: {
          some: {
            workspaceId: user.workspaceId,
            status: "active",
            student: visibleStudentWhere(user),
          },
        },
      },
    ],
  };
}

export function visibleCourseByIdWhere(user: TeacherVisibilityUser, courseId: string): Prisma.CourseWhereInput {
  return {
    id: courseId,
    ...visibleCourseWhere(user),
  };
}

export function deletableCourseByIdWhere(user: TeacherVisibilityUser, courseId: string): Prisma.CourseWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { id: courseId, workspaceId: user.workspaceId };
  }

  return {
    id: courseId,
    workspaceId: user.workspaceId,
    createdById: user.id,
  };
}

export function canDeleteCourse(user: TeacherVisibilityUser, course: { createdById: string | null }) {
  return teacherSeesAllWorkspaceData(user) || course.createdById === user.id;
}

export function visibleScheduleWhere(user: TeacherVisibilityUser): Prisma.ScheduleWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      { student: visibleStudentWhere(user) },
      { course: visibleCourseWhere(user) },
    ],
  };
}
