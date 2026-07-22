import type { Prisma } from "@prisma/client";

export type TeacherVisibilityUser = {
  id: string;
  workspaceId: string;
  role: string;
  teachingSubject?: string | null;
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

export function visibleProgressStudentWhere(user: TeacherVisibilityUser): Prisma.StudentWhereInput {
  const teachingSubject = user.teachingSubject?.trim();
  if (teacherSeesAllWorkspaceData(user) || !teachingSubject) return visibleStudentWhere(user);

  return {
    workspaceId: user.workspaceId,
    OR: [
      {
        createdById: user.id,
        learningLinks: {
          none: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
            subject: { not: teachingSubject },
          },
        },
      },
      {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
            subject: teachingSubject,
          },
        },
      },
    ],
  };
}

export function visibleProgressStudentByIdWhere(
  user: TeacherVisibilityUser,
  studentId: string,
): Prisma.StudentWhereInput {
  return {
    id: studentId,
    ...visibleProgressStudentWhere(user),
  };
}

export function deletableStudentByIdWhere(user: TeacherVisibilityUser, studentId: string): Prisma.StudentWhereInput {
  if (user.role === "admin") {
    return { id: studentId, workspaceId: user.workspaceId };
  }

  return {
    id: "__admin_only__",
    workspaceId: user.workspaceId,
  };
}

export function canDeleteStudent(user: TeacherVisibilityUser, _student: { createdById: string | null }) {
  return user.role === "admin";
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
    ],
  };
}

export function teacherSubjectMatches(user: TeacherVisibilityUser, subject: string | null | undefined) {
  const teachingSubject = user.teachingSubject?.trim();
  if (teacherSeesAllWorkspaceData(user) || !teachingSubject) return true;
  return subject?.trim() === teachingSubject;
}

export function visibleProgressCourseWhere(user: TeacherVisibilityUser): Prisma.CourseWhereInput {
  const teachingSubject = user.teachingSubject?.trim();
  if (teacherSeesAllWorkspaceData(user) || !teachingSubject) return visibleCourseWhere(user);

  return {
    workspaceId: user.workspaceId,
    OR: [
      {
        createdById: user.id,
        learningLinks: {
          none: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
            subject: { not: teachingSubject },
          },
        },
      },
      {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
            subject: teachingSubject,
          },
        },
      },
    ],
  };
}

export function visibleProgressWeakPointWhere(user: TeacherVisibilityUser): Prisma.WeakPointWhereInput {
  const teachingSubject = user.teachingSubject?.trim();
  if (teacherSeesAllWorkspaceData(user) || !teachingSubject) {
    return {
      workspaceId: user.workspaceId,
      student: visibleProgressStudentWhere(user),
    };
  }

  return {
    workspaceId: user.workspaceId,
    student: visibleProgressStudentWhere(user),
    OR: [
      {
        learningLink: {
          workspaceId: user.workspaceId,
          teacherId: user.id,
          isActive: true,
          subject: teachingSubject,
        },
      },
      {
        learningLinkId: null,
        student: { workspaceId: user.workspaceId, createdById: user.id },
      },
    ],
  };
}

export function visibleExamWhere(user: TeacherVisibilityUser): Prisma.ExamWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      {
        learningLink: {
          workspaceId: user.workspaceId,
          teacherId: user.id,
          isActive: true,
        },
      },
      {
        learningLinkId: null,
        student: { workspaceId: user.workspaceId, createdById: user.id },
      },
    ],
  };
}

export function visibleReviewScheduleWhere(user: TeacherVisibilityUser): Prisma.ReviewScheduleWhereInput {
  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  return {
    workspaceId: user.workspaceId,
    weakPoint: {
      OR: [
        {
          learningLink: {
            workspaceId: user.workspaceId,
            teacherId: user.id,
            isActive: true,
          },
        },
        {
          learningLinkId: null,
          student: { workspaceId: user.workspaceId, createdById: user.id },
        },
      ],
    },
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
      { course: visibleCourseWhere(user) },
      {
        courseId: null,
        student: { workspaceId: user.workspaceId, createdById: user.id },
      },
    ],
  };
}
