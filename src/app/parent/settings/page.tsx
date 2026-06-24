import { requireParent } from "@/lib/auth";
import { SettingsClient } from "@/components/settings-client";

export default async function ParentSettingsPage() {
  const user = await requireParent();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">账号设置</h1>
        <p className="mt-1 text-sm text-slate-500">修改当前家长账号密码</p>
      </div>
      <SettingsClient role={user.role} initialBackups={[]} />
    </div>
  );
}
