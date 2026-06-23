import { requireParent } from "@/lib/auth";
import { ResourceCenter } from "@/components/resource-center";

export default async function ParentResourcesPage() {
  const user = await requireParent();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">资料中心</h1>
        <p className="mt-1 text-sm text-slate-500">搜索已授权的课程资料，可以直接预览和下载</p>
      </div>
      <ResourceCenter role={user.role} />
    </div>
  );
}
