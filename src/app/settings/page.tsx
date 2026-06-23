import { requireCurrentUser } from "@/lib/auth";
import { listDatabaseBackups } from "@/lib/database-backups";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const backups = user.role === "admin" ? await listDatabaseBackups() : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">系统设置</h1>
        <p className="mt-1 text-sm text-slate-500">修改个人密码，管理员可查看数据库备份</p>
      </div>
      <SettingsClient role={user.role} initialBackups={backups} />
    </div>
  );
}
