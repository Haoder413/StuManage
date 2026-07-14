"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ResourceCourseDialog } from "@/components/resource-course-dialog";
import type { CourseOption, ResourceGroupItem, ResourceGroupPage } from "@/types/resource-library";

export function ResourceGroupList({
  role,
  courses,
  refreshToken,
}: {
  role: string;
  courses: CourseOption[];
  refreshToken: number;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<ResourceGroupPage>({ items: [], total: 0, page: 1, pageSize: 30, hasNextPage: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const canManage = role === "admin" || role === "teacher" || role === "demo";

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", "30");
    try {
      const response = await fetch(`/api/resource-groups?${params.toString()}`, { signal });
      if (!response.ok) throw new Error("load_failed");
      setData(await response.json());
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError("资料加载失败，请稍后重试。");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    setSelectedGroupIds([]);
    return () => controller.abort();
  }, [searchParams, refreshToken]);

  function setPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page"); else params.set("page", String(page));
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  async function deleteGroup(group: ResourceGroupItem) {
    if (!window.confirm(`确定删除“${group.title}”及其中全部文件吗？此操作无法撤销。`)) return;
    const response = await fetch(`/api/resource-groups/${group.id}`, { method: "DELETE" });
    if (!response.ok) return setError("删除失败，请稍后重试。");
    await load();
  }

  const manageableItems = useMemo(() => data.items.filter((group) => group.canManage), [data.items]);
  const selectedItems = useMemo(() => manageableItems.filter((item) => selectedGroupIds.includes(item.id)), [manageableItems, selectedGroupIds]);
  const selectedWorkspaceIds = Array.from(new Set(selectedItems.map((item) => item.workspaceId)));
  const batchWorkspaceId = selectedWorkspaceIds.length === 1 ? selectedWorkspaceIds[0] : undefined;

  if (loading) return <div className="rounded-xl border bg-white py-16 text-center text-sm text-slate-400">正在加载资料库…</div>;
  if (error && data.items.length === 0) return <div className="rounded-xl border bg-white py-16 text-center text-sm text-rose-500">{error}</div>;

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" disabled={manageableItems.length === 0} checked={manageableItems.length > 0 && manageableItems.every((item) => selectedGroupIds.includes(item.id))} onChange={(event) => setSelectedGroupIds(event.target.checked ? manageableItems.map((item) => item.id) : [])} />
            本页全选
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">已选 {selectedGroupIds.length} 套</span>
            <ResourceCourseDialog
              groupIds={selectedGroupIds}
              courses={batchWorkspaceId ? courses : []}
              workspaceId={batchWorkspaceId}
              endpoint="/api/resource-groups/batch-courses"
              onSaved={() => void load()}
            />
          </div>
        </div>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {data.items.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <p className="font-semibold text-slate-600">{searchParams.toString() ? "没有符合条件的资料" : "资料库还是空的"}</p>
          <p className="mt-1 text-sm text-slate-400">{searchParams.toString() ? "可以清除部分筛选条件后重试。" : "上传第一套资料后，会在这里按资料组展示。"}</p>
        </div>
      ) : data.items.map((group) => (
        <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            {group.canManage && <input aria-label={`选择 ${group.title}`} type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={(event) => setSelectedGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{group.title}</h3>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">{kindLabel(group.resourceKind)}</span>
                {group.infoNeedsReview && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">信息待完善</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">{group.grade || "未设置年级"} · {group.year ? `${group.year}年` : "未设置年份"} · {group.subject || "未设置科目"} · {formatSize(group.totalSize)} · {group.createdByName}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{group.tags.length > 0 ? group.tags.map((tag) => <span key={tag.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tag.name}</span>) : <span className="text-xs text-slate-400">暂无标签</span>}</div>
              {group.courses.length > 0 && <p className="mt-2 text-xs text-emerald-600">已同步：{group.courses.map((course) => course.name).join("、")}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.canManage && <EditGroupDialog group={group} onSaved={() => void load()} />}
              {group.canManage && <AddVersionDialog group={group} onSaved={() => void load()} />}
              {group.canManage && <ResourceCourseDialog groupIds={[group.id]} courses={courses} workspaceId={group.workspaceId} onSaved={() => void load()} />}
              {group.canManage && <Button type="button" size="sm" variant="destructive" onClick={() => void deleteGroup(group)}>删除</Button>}
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {group.files.map((file) => (
              <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${file.role === "answer" ? "bg-orange-100 text-orange-700" : file.role === "student" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{roleLabel(file.role)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={file.originalName}>{file.originalName}</span>
                {file.canPreview && <a className="text-xs font-semibold text-sky-600" href={`/api/resource-groups/${group.id}/files/${file.id}?mode=preview`} target="_blank">预览</a>}
                {file.canDownload && <a className="text-xs font-semibold text-sky-600" href={`/api/resource-groups/${group.id}/files/${file.id}?mode=download`}>下载</a>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm text-slate-500">
        <span>共 {data.total} 套资料，第 {data.page} 页</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>上一页</Button>
          <Button type="button" size="sm" variant="outline" disabled={!data.hasNextPage} onClick={() => setPage(data.page + 1)}>下一页</Button>
        </div>
      </div>
    </div>
  );
}

function EditGroupDialog({ group, onSaved }: { group: ResourceGroupItem; onSaved: () => void }) {
  const initialForm = () => ({
    title: group.title,
    description: group.description || "",
    grade: group.grade || "",
    year: group.year ? String(group.year) : "",
    subject: group.subject || "",
    resourceKind: group.resourceKind,
    tags: group.tags.map((tag) => tag.name).join("，"),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!form.title.trim()) return setMessage("标题不能为空。");
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/resource-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        grade: form.grade,
        year: form.year,
        subject: form.subject,
        resourceKind: form.resourceKind,
        tags: form.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
        confirmInformation: true,
      }),
    });
    setSaving(false);
    if (!response.ok) return setMessage("保存失败，请检查资料信息。");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setForm(initialForm()); setMessage(""); } }}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline">编辑</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>编辑资料信息</DialogTitle><DialogDescription>完善标题、分类和标签后，搜索结果会立即更新。</DialogDescription></DialogHeader>
        <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="资料标题" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} placeholder="年级" />
          <Input type="number" min={1900} max={2100} value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="年份（可留空）" />
          <Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="科目" />
        </div>
        <Select value={form.resourceKind} onValueChange={(value) => setForm({ ...form, resourceKind: value as typeof form.resourceKind })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="paper">试卷</SelectItem><SelectItem value="animation">动画</SelectItem><SelectItem value="material">普通资料</SelectItem></SelectContent>
        </Select>
        <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="标签，用逗号分隔" />
        <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="资料说明" rows={3} />
        {message && <p className="text-sm text-rose-600">{message}</p>}
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "保存资料信息"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function AddVersionDialog({ group, onSaved }: { group: ResourceGroupItem; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<"student" | "answer" | "supplement">("supplement");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("role", role);
    const response = await fetch(`/api/resource-groups/${group.id}`, { method: "POST", body: formData });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error === "duplicate_primary_role" ? "该资料组已经有这个版本。" : payload.error === "duplicate_file" ? "资料库中已有完全相同的文件。" : "补传失败，请稍后重试。");
      return;
    }
    setOpen(false);
    setFile(null);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline">补传版本</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>补传资料版本</DialogTitle><DialogDescription>补传后，已获得课程权限的家长会自动看到新版本。</DialogDescription></DialogHeader>
        <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="student">学生版</SelectItem><SelectItem value="answer">答案版</SelectItem><SelectItem value="supplement">补充资料</SelectItem></SelectContent>
        </Select>
        <Input type="file" accept=".pdf,.doc,.docx,.html,.htm" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} />
        {message && <p className="text-sm text-rose-600">{message}</p>}
        <Button type="button" disabled={!file || saving} onClick={() => void submit()}>{saving ? "上传中…" : "确认补传"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function roleLabel(role: string) {
  if (role === "student") return "学生版";
  if (role === "answer") return "答案版";
  return "补充";
}

function kindLabel(kind: string) {
  if (kind === "animation") return "动画";
  if (kind === "material") return "资料";
  return "试卷";
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
