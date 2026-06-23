"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BackupItem = {
  fileName: string;
  size: number;
  modifiedAt: string;
};

export function SettingsClient({ role, initialBackups }: { role: string; initialBackups: BackupItem[] }) {
  const router = useRouter();
  const [backups, setBackups] = useState(initialBackups);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [isBackingUp, setIsBackingUp] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
        confirmPassword: form.get("confirmPassword"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPasswordMessage(data.error || "修改失败");
      return;
    }
    router.replace(data.redirectTo || "/login");
    router.refresh();
  }

  async function createBackup() {
    setIsBackingUp(true);
    setBackupMessage("");
    const response = await fetch("/api/system/backups", { method: "POST" });
    const data = await response.json();
    if (response.ok) {
      setBackups(data);
      setBackupMessage("已完成一次数据库备份");
    } else {
      setBackupMessage(data.error || "备份失败");
    }
    setIsBackingUp(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>修改密码</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <Input name="currentPassword" type="password" placeholder="当前密码" required />
            <Input name="newPassword" type="password" placeholder="新密码，至少 6 位" required />
            <Input name="confirmPassword" type="password" placeholder="再次输入新密码" required />
            {passwordMessage && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{passwordMessage}</p>}
            <Button type="submit">保存新密码</Button>
          </form>
        </CardContent>
      </Card>

      {role === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>数据库备份</CardTitle>
              <Button onClick={createBackup} disabled={isBackingUp} type="button" variant="outline">
                {isBackingUp ? "备份中..." : "立即备份"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {backupMessage && <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{backupMessage}</p>}
            <div className="space-y-2">
              {backups.length === 0 ? (
                <p className="text-sm text-slate-400">暂无数据库备份</p>
              ) : backups.map((backup) => (
                <div key={backup.fileName} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{backup.fileName}</p>
                    <p className="text-xs text-slate-400">{new Date(backup.modifiedAt).toLocaleString("zh-CN")}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatSize(backup.size)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
