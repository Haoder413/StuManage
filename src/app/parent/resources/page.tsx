import { requireParent } from "@/lib/auth";
import { ResourceCenter } from "@/components/resource-center";

export default async function ParentResourcesPage() {
  const user = await requireParent();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">资料中心</h1>
        <p className="mt-1 text-sm text-slate-500">搜索试卷和动画资料，有权限后可以预览和下载</p>
      </div>
      <ResourceCenter role={user.role} />
    </div>
  );
}
