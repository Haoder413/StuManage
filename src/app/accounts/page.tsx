import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AccountManager } from "./account-manager";

export default async function AccountsPage() {
  await requireAdmin();
  const [users, workspaces, students] = await Promise.all([
    prisma.user.findMany({
      include: {
        workspace: true,
        parentStudents: { include: { student: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workspace.findMany({ orderBy: { name: "asc" } }),
    prisma.student.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="账号管理" description="设置管理员、老师、演示和家长账号" />
      <AccountManager
        initialUsers={users.map((user) => ({
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
          workspaceName: user.workspace.name,
          parentStudentIds: user.parentStudents.map((item) => item.studentId),
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
      />
    </div>
  );
}
