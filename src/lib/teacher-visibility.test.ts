import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteStudent,
  deletableStudentByIdWhere,
  teacherSubjectMatches,
  visibleProgressCourseWhere,
  visibleProgressStudentWhere,
  visibleProgressWeakPointWhere,
} from "./teacher-visibility";

const baseUser = {
  id: "user-1",
  workspaceId: "workspace-1",
};

test("only administrators can delete students", () => {
  const student = { createdById: "user-1" };

  assert.equal(canDeleteStudent({ ...baseUser, role: "admin" }, student), true);
  assert.equal(canDeleteStudent({ ...baseUser, role: "teacher" }, student), false);
  assert.equal(canDeleteStudent({ ...baseUser, role: "demo" }, student), false);
});

test("non-administrators receive a delete filter that cannot match a student", () => {
  assert.deepEqual(
    deletableStudentByIdWhere({ ...baseUser, role: "teacher" }, "student-1"),
    { id: "__admin_only__", workspaceId: "workspace-1" },
  );
});

test("teacher progress courses exclude active links from other subjects", () => {
  assert.deepEqual(visibleProgressCourseWhere({
    ...baseUser,
    role: "teacher",
    teachingSubject: "数学",
  }), {
    workspaceId: "workspace-1",
    OR: [
      {
        createdById: "user-1",
        learningLinks: {
          none: {
            workspaceId: "workspace-1",
            teacherId: "user-1",
            isActive: true,
            subject: { not: "数学" },
          },
        },
      },
      {
        learningLinks: {
          some: {
            workspaceId: "workspace-1",
            teacherId: "user-1",
            isActive: true,
            subject: "数学",
          },
        },
      },
    ],
  });
  assert.equal(teacherSubjectMatches({ ...baseUser, role: "teacher", teachingSubject: "数学" }, "物理"), false);
  assert.equal(teacherSubjectMatches({ ...baseUser, role: "teacher", teachingSubject: "数学" }, " 数学 "), true);
});

test("progress students and weak points use the teacher subject", () => {
  const user = { ...baseUser, role: "teacher", teachingSubject: "数学" };
  const studentWhere = visibleProgressStudentWhere(user);
  assert.deepEqual(studentWhere, {
    workspaceId: "workspace-1",
    OR: [
      {
        createdById: "user-1",
        learningLinks: {
          none: {
            workspaceId: "workspace-1",
            teacherId: "user-1",
            isActive: true,
            subject: { not: "数学" },
          },
        },
      },
      {
        learningLinks: {
          some: {
            workspaceId: "workspace-1",
            teacherId: "user-1",
            isActive: true,
            subject: "数学",
          },
        },
      },
    ],
  });
  assert.deepEqual(visibleProgressWeakPointWhere(user), {
    workspaceId: "workspace-1",
    student: studentWhere,
    OR: [
      {
        learningLink: {
          workspaceId: "workspace-1",
          teacherId: "user-1",
          isActive: true,
          subject: "数学",
        },
      },
      {
        learningLinkId: null,
        student: { workspaceId: "workspace-1", createdById: "user-1" },
      },
    ],
  });
});
