import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResourceCenter } from "@/components/resource-center";
import { PageHeader } from "@/components/page-header";

export default async function ResourcesPage() {
  const user = await requireCurrentUser();
  const controlledUsers = user.role === "admin"
    ? await prisma.user.findMany({
        where: { role: { in: ["parent", "demo"] } },
        select: { id: true, name: true, phone: true, role: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      })
    : [];
  const workspaces = user.role === "admin"
    ? await prisma.workspace.findMany({ orderBy: { name: "asc" } })
    : [];

  return (
    <div>
      <PageHeader title="资料中心" description="上传资料，管理试卷和动画资源" />
      <ResourceCenter
        role={user.role}
        controlledUsers={controlledUsers}
        workspaces={workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))}
      />
    </div>
  );
}
