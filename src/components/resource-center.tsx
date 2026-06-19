"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ResourceItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileName: string;
  extension: string;
  size: number;
  grade: string | null;
  keywords: string | null;
  workspaceId: string;
  canPreview: boolean;
  canDownload: boolean;
  locked: boolean;
  permissions?: { userId: string; canPreview: boolean; canDownload: boolean }[];
};

type ControlledUser = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
};

export function ResourceCenter({
  role,
  controlledUsers = [],
  workspaces = [],
}: {
  role: string;
  controlledUsers?: ControlledUser[];
  workspaces?: { id: string; name: string }[];
}) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [message, setMessage] = useState("");
  const canUpload = role === "admin" || role === "teacher";
  const canGrant = role === "admin";

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type !== "all") params.set("type", type);
    const res = await fetch(`/api/resources?${params.toString()}`);
    if (res.ok) setResources(await res.json());
  }

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const res = await fetch("/api/resources", { method: "POST", body: formData });
    if (!res.ok) {
      setMessage("上传失败，请检查文件格式");
      return;
    }
    form.reset();
    setMessage("上传成功");
    await loadResources();
  }

  async function savePermission(resourceId: string, userId: string, canPreview: boolean, canDownload: boolean) {
    await fetch("/api/resource-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, userId, canPreview, canDownload }),
    });
    setMessage("授权已保存");
  }

  const title = useMemo(() => role === "parent" || role === "demo" ? "搜索资料" : "资料管理", [role]);

  return (
    <div className="space-y-6">
      {canUpload && (
        <Card>
          <CardHeader><CardTitle>上传资料</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={uploadResource} className="grid gap-3 md:grid-cols-6">
              <Input name="title" placeholder="标题" className="md:col-span-2" required />
              {role === "admin" && (
                <Select name="workspaceId" defaultValue={workspaces[0]?.id || "default-real"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select name="type" defaultValue="paper">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper">试卷</SelectItem>
                  <SelectItem value="animation">动画</SelectItem>
                </SelectContent>
              </Select>
              <Input name="grade" placeholder="年级" />
              <Input name="keywords" placeholder="关键词" />
              <Input name="file" type="file" accept=".pdf,.doc,.docx,.html,.htm" required />
              <Input name="description" placeholder="说明" className={role === "admin" ? "md:col-span-4" : "md:col-span-5"} />
              <Button type="submit">上传资料</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_100px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、说明、年级、关键词" />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="paper">试卷</SelectItem>
                <SelectItem value="animation">动画</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" onClick={loadResources}>搜索</Button>
          </div>

          {message && <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-slate-400">暂无资料</p>
            ) : resources.map((resource) => (
              <div key={resource.id} className="overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md">
                <ResourceThumbnail resource={resource} />

                <div className="space-y-4 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{resource.title}</h3>
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">{resource.type === "paper" ? "试卷" : "动画"}</span>
                      {resource.locked && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">上锁</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{resource.description || resource.fileName}</p>
                    <p className="mt-1 text-xs text-slate-400">{resource.grade || "未设置年级"} · {resource.keywords || "无关键词"} · {formatSize(resource.size)}</p>
                  </div>
                  <div className="flex gap-2">
                    {resource.canPreview ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/resources/${resource.id}/file?mode=preview`} target="_blank">预览</a>
                      </Button>
                    ) : (
                      <Button disabled size="sm" variant="outline">预览</Button>
                    )}
                    {resource.canDownload ? (
                      <Button asChild size="sm">
                        <a href={`/api/resources/${resource.id}/file?mode=download`}>下载</a>
                      </Button>
                    ) : (
                      <Button disabled size="sm">下载</Button>
                    )}
                  </div>
                </div>

                {canGrant && controlledUsers.length > 0 && (
                  <div className="border-t p-4 pt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">授权</p>
                    <div className="grid gap-2">
                      {controlledUsers.map((user) => (
                        <PermissionRow
                          key={user.id}
                          resourceId={resource.id}
                          user={user}
                          permission={resource.permissions?.find((permission) => permission.userId === user.id)}
                          onSave={savePermission}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceThumbnail({ resource }: { resource: ResourceItem }) {
  if (resource.type === "animation") {
    if (resource.canPreview) {
      return (
        <div className="aspect-[16/9] overflow-hidden border-b bg-slate-100">
          <iframe
            className="h-full w-full scale-[0.72] border-0 bg-white"
            sandbox="allow-scripts"
            src={`/api/resources/${resource.id}/file?mode=preview`}
            title={`${resource.title} 缩略图`}
          />
        </div>
      );
    }

    return (
      <div className="aspect-[16/9] border-b bg-slate-100 p-4">
        <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-semibold text-slate-400">
          上锁
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[16/9] border-b bg-gradient-to-br from-sky-50 to-slate-100 p-4">
      <div className="flex h-full items-center justify-center rounded-md border border-white/70 bg-white/70">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-700">{resource.extension.replace(".", "").toUpperCase()}</p>
          <p className="mt-1 text-xs text-slate-400">{resource.type === "paper" ? "试卷" : "资料"}</p>
        </div>
      </div>
    </div>
  );
}

function PermissionRow({
  resourceId,
  user,
  permission,
  onSave,
}: {
  resourceId: string;
  user: ControlledUser;
  permission?: { canPreview: boolean; canDownload: boolean };
  onSave: (resourceId: string, userId: string, canPreview: boolean, canDownload: boolean) => void;
}) {
  const [canPreview, setCanPreview] = useState(Boolean(permission?.canPreview));
  const [canDownload, setCanDownload] = useState(Boolean(permission?.canDownload));

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-700">{user.name} · {user.role === "demo" ? "演示" : "家长"}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input checked={canPreview} onChange={(event) => setCanPreview(event.target.checked)} type="checkbox" />
          预览
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input checked={canDownload} onChange={(event) => setCanDownload(event.target.checked)} type="checkbox" />
          下载
        </label>
        <button className="text-xs font-semibold text-sky-600" onClick={() => onSave(resourceId, user.id, canPreview, canDownload)} type="button">
          保存
        </button>
      </div>
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
