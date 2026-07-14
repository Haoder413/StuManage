import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParentResourceLibrary } from "@/components/parent-resource-library";

export default async function ParentResourcesPage() {
  const user = await requireParent();
  const learningLinks = await prisma.learningLink.findMany({
    where: { parentId: user.id, workspaceId: user.workspaceId, isActive: true, courseId: { not: null } },
    include: { course: { select: { id: true, name: true, workspaceId: true } } },
    orderBy: { createdAt: "desc" },
  });
  const courses = Array.from(new Map(
    learningLinks.filter((link) => link.course).map((link) => [link.course!.id, link.course!])
  ).values());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">资料中心</h1>
        <p className="mt-1 text-sm text-slate-500">搜索已授权的课程资料，可以直接预览和下载</p>
      </div>
      <ParentResourceLibrary courses={courses} />
    </div>
  );
}
