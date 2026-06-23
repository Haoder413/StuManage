import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AccountManager } from "./account-manager";

export default async function AccountsPage() {
  await requireAdmin();
  const [users, workspaces, students, courses, learningLinks] = await Promise.all([
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
    prisma.course.findMany({ orderBy: { name: "asc" } }),
    prisma.learningLink.findMany({
      include: { parent: true, student: true, teacher: true, course: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const teachers = users.filter((user) => user.role === "teacher");
  const parents = users.filter((user) => user.role === "parent");

  return (
    <div>
      <PageHeader title="账号与学习关系" description="设置账号、老师教学科目，并绑定家长-学生-老师-科目的学习关系" />
      <AccountManager
        initialUsers={users.map((user) => ({
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          teachingSubject: user.teachingSubject,
          workspaceId: user.workspaceId,
          workspaceName: user.workspace.name,
          parentStudentIds: user.parentStudents.map((item) => item.studentId),
          learningLinks: user.learningLinksAsParent.map((link) => link.id),
        }))}
        workspaces={workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          kind: workspace.kind,
        }))}
        students={students.map((student) => ({
          id: student.id,
          workspaceId: student.workspaceId,
          name: student.name,
          grade: student.grade,
        }))}
        courses={courses.map((course) => ({
          id: course.id,
          workspaceId: course.workspaceId,
          name: course.name,
        }))}
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          workspaceId: teacher.workspaceId,
          name: teacher.name,
          teachingSubject: teacher.teachingSubject,
        }))}
        parents={parents.map((parent) => ({
          id: parent.id,
          workspaceId: parent.workspaceId,
          name: parent.name,
        }))}
        learningLinks={learningLinks.map((link) => ({
          id: link.id,
          workspaceId: link.workspaceId,
          parentId: link.parentId,
          studentId: link.studentId,
          teacherId: link.teacherId,
          courseId: link.courseId,
          subject: link.subject,
          isActive: link.isActive,
          parentName: link.parent.name,
          studentName: link.student.name,
          teacherName: link.teacher.name,
          courseName: link.course?.name || null,
        }))}
      />
    </div>
  );
}
