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
  subject: string | null;
  resourceKind: string;
  fileName: string;
  extension: string;
  size: number;
  grade: string | null;
  keywords: string | null;
  workspaceId: string;
  canPreview: boolean;
  canDownload: boolean;
  courseIds?: string[];
  coursePermissions?: { courseId: string }[];
};

type CourseOption = {
  id: string;
  name: string;
  workspaceId: string;
};

export function ResourceCenter({
  role,
  workspaces = [],
  courses = [],
}: {
  role: string;
  workspaces?: { id: string; name: string }[];
  courses?: CourseOption[];
}) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [resourceKindFilter, setResourceKindFilter] = useState("all");
  const [message, setMessage] = useState("");
  const canUpload = role === "admin" || role === "teacher";
  const canGrant = role === "admin" || role === "teacher";

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (gradeFilter !== "all") params.set("grade", gradeFilter);
    if (subjectFilter !== "all") params.set("subject", subjectFilter);
    if (resourceKindFilter !== "all") params.set("resourceKind", resourceKindFilter);
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

  async function savePermission(resourceId: string, courseIds: string[]) {
    await fetch("/api/resource-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, courseIds }),
    });
    setMessage("授权已保存");
    await loadResources();
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
              <Select name="resourceKind" defaultValue="paper">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper">试卷</SelectItem>
                  <SelectItem value="animation">动画</SelectItem>
                  <SelectItem value="material">资料</SelectItem>
                </SelectContent>
              </Select>
              <Input name="grade" placeholder="年级" />
              <Input name="subject" placeholder="科目" />
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
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_140px_140px_160px_100px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、说明、年级、关键词" />
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部年级</SelectItem>
                <SelectItem value="小五">小五</SelectItem>
                <SelectItem value="小六">小六</SelectItem>
                <SelectItem value="初一">初一</SelectItem>
                <SelectItem value="初二">初二</SelectItem>
                <SelectItem value="初三">初三</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部科目</SelectItem>
                <SelectItem value="数学">数学</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceKindFilter} onValueChange={setResourceKindFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部资料属性</SelectItem>
                <SelectItem value="paper">试卷</SelectItem>
                <SelectItem value="animation">动画</SelectItem>
                <SelectItem value="material">资料</SelectItem>
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
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">{resourceKindLabel(resource.resourceKind)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{resource.description || resource.fileName}</p>
                    <p className="mt-1 text-xs text-slate-400">{resource.grade || "未设置年级"} · {resource.subject || "未设置科目"} · {resource.keywords || "无关键词"} · {formatSize(resource.size)}</p>
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

                {canGrant && courses.length > 0 && (
                  <div className="border-t p-4 pt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">授权课程</p>
                    <CourseGrantPanel
                      resourceId={resource.id}
                      courses={courses.filter((course) => course.workspaceId === resource.workspaceId)}
                      selectedCourseIds={resource.courseIds || resource.coursePermissions?.map((permission) => permission.courseId) || []}
                      onSave={savePermission}
                    />
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
          无预览权限
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

function CourseGrantPanel({
  resourceId,
  courses,
  selectedCourseIds,
  onSave,
}: {
  resourceId: string;
  courses: CourseOption[];
  selectedCourseIds: string[];
  onSave: (resourceId: string, courseIds: string[]) => void;
}) {
  const [selectedIds, setSelectedCourseIds] = useState(selectedCourseIds);

  useEffect(() => {
    setSelectedCourseIds(selectedCourseIds);
  }, [selectedCourseIds.join("|")]);

  function toggleCourse(courseId: string, checked: boolean) {
    setSelectedCourseIds((current) =>
      checked ? Array.from(new Set([...current, courseId])) : current.filter((id) => id !== courseId)
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <div className="grid gap-2">
        {courses.length === 0 ? (
          <p className="text-xs text-slate-400">该资料所在工作区暂无课程</p>
        ) : courses.map((course) => (
          <label key={course.id} className="flex items-center gap-2 text-xs text-slate-600">
            <input
              checked={selectedIds.includes(course.id)}
              onChange={(event) => toggleCourse(course.id, event.target.checked)}
              type="checkbox"
            />
            {course.name}
          </label>
        ))}
      </div>
      <button className="text-xs font-semibold text-sky-600" onClick={() => onSave(resourceId, selectedIds)} type="button">
        保存授权
      </button>
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function resourceKindLabel(resourceKind: string) {
  if (resourceKind === "animation") return "动画";
  if (resourceKind === "material") return "资料";
  return "试卷";
}
