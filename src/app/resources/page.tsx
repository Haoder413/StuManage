import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResourceCenter } from "@/components/resource-center";
import { PageHeader } from "@/components/page-header";

export default async function ResourcesPage() {
  const user = await requireCurrentUser();
  const workspaces = user.role === "admin"
    ? await prisma.workspace.findMany({ orderBy: { name: "asc" } })
    : [];
  const courses = await prisma.course.findMany({
    where: user.role === "admin" ? {} : { workspaceId: user.workspaceId },
    select: { id: true, name: true, workspaceId: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="资料中心" description="上传资料，管理试卷和动画资源" />
      <ResourceCenter
        role={user.role}
        workspaces={workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))}
        courses={courses}
      />
    </div>
  );
}
