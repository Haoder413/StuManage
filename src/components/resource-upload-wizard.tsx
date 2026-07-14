"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResourceGroupEditor, type EditableUploadGroup } from "@/components/resource-group-editor";
import { createUniqueUploadGroupKey, mergeUploadGroup } from "@/lib/resource-upload-groups";
import { extractResourceYear } from "@/lib/resource-metadata";
import type { CourseOption, WorkspaceOption } from "@/types/resource-library";

type AnalysisResponse = { source: "local" | "deepseek"; groups: Array<Omit<EditableUploadGroup, "courseIds">> };

function manualGroups(files: File[]): EditableUploadGroup[] {
  return files.map((file, index) => ({
    groupKey: `manual-${index}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    grade: null,
    year: extractResourceYear(file.name),
    subject: null,
    resourceKind: /\.html?$/i.test(file.name) ? "animation" : "paper",
    tags: [],
    confidence: 0,
    needsConfirmation: true,
    reason: "AI 整理暂不可用，可继续手动上传",
    courseIds: [],
    files: [{ originalName: file.name, role: "supplement" }],
  }));
}

export function ResourceUploadWizard({
  role,
  workspaces,
  courses,
  onUploaded,
}: {
  role: string;
  workspaces: WorkspaceOption[];
  courses: CourseOption[];
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [groups, setGroups] = useState<EditableUploadGroup[]>([]);
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id || "default-real");
  const [state, setState] = useState<"select" | "analyzing" | "organize" | "uploading">("select");
  const [message, setMessage] = useState("");
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const availableCourses = useMemo(
    () => role === "admin" ? courses.filter((course) => course.workspaceId === workspaceId) : courses,
    [courses, role, workspaceId]
  );

  function reset() {
    setFiles([]);
    setGroups([]);
    setState("select");
    setMessage("");
    setDuplicateConfirmed(false);
  }

  async function organize(selected: File[]) {
    if (selected.length === 0) return;
    setFiles(selected);
    setState("analyzing");
    setMessage("");
    try {
      const response = await fetch("/api/resources/analyze-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: selected.map((file) => file.name) }),
      });
      if (!response.ok) throw new Error("analysis_failed");
      const result = await response.json() as AnalysisResponse;
      setGroups(result.groups.map((group) => ({ ...group, courseIds: [] })));
      setMessage(result.source === "deepseek" ? "DeepSeek 已根据文件名完成整理，请确认后上传。" : "已使用本地规则整理，请确认后上传。");
    } catch {
      setGroups(manualGroups(selected));
      setMessage("AI 整理暂不可用，可继续手动上传");
    } finally {
      setState("organize");
    }
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    void organize(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void organize(Array.from(event.dataTransfer.files));
  }

  function updateGroup(index: number, next: EditableUploadGroup) {
    setGroups((current) => current.map((group, groupIndex) => groupIndex === index ? next : group));
  }

  function splitFile(groupIndex: number, fileIndex: number) {
    setGroups((current) => {
      const source = current[groupIndex];
      const file = source.files[fileIndex];
      const remaining = { ...source, files: source.files.filter((_, index) => index !== fileIndex) };
      const splitKey = createUniqueUploadGroupKey(current, `${source.groupKey}-split-${fileIndex}`);
      const split: EditableUploadGroup = {
        ...source,
        groupKey: splitKey,
        title: file.originalName.replace(/\.[^.]+$/, ""),
        year: extractResourceYear(file.originalName) ?? source.year,
        files: [file],
        needsConfirmation: true,
        reason: "已拆分为独立资料，请确认信息",
      };
      return [...current.slice(0, groupIndex), remaining, split, ...current.slice(groupIndex + 1)];
    });
  }

  async function upload() {
    if (groups.some((group) => !group.title.trim())) {
      setMessage("请补充所有资料标题。");
      return;
    }
    setState("uploading");
    setMessage(`正在上传 ${files.length} 个文件，请不要关闭窗口…`);
    const usedIndices = new Set<number>();
    const manifest = {
      groups: groups.map((group) => ({
        title: group.title,
        grade: group.grade,
        year: group.year,
        subject: group.subject,
        resourceKind: group.resourceKind,
        tags: group.tags,
        courseIds: group.courseIds,
        files: group.files.map((file) => {
          const fileIndex = files.findIndex((candidate, index) => candidate.name === file.originalName && !usedIndices.has(index));
          usedIndices.add(fileIndex);
          return { fileIndex, role: file.role, confirmDuplicate: duplicateConfirmed };
        }),
      })),
    };
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.set("manifest", JSON.stringify(manifest));
    if (role === "admin") formData.set("workspaceId", workspaceId);
    try {
      const response = await fetch("/api/resource-groups", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setDuplicateConfirmed(true);
          throw new Error("发现与资料库完全相同的文件。确认无误后，再次点击上传即可继续。");
        }
        throw new Error(payload.error || "上传失败");
      }
      setMessage("上传成功");
      onUploaded();
      setOpen(false);
      reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败，请稍后重试");
      setState("organize");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild><Button>批量上传资料</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量上传与 AI 整理</DialogTitle>
          <DialogDescription>DeepSeek 只分析文件名，不读取或上传试卷正文；它会建议学生版、答案版及配对关系，所有结果都由老师确认后保存。</DialogDescription>
        </DialogHeader>
        {role === "admin" && workspaces.length > 0 && (
          <Select value={workspaceId} onValueChange={(value) => {
            setWorkspaceId(value);
            setGroups((current) => current.map((group) => ({ ...group, courseIds: [] })));
          }}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {state === "select" && (
          <div onDrop={onDrop} onDragOver={(event) => event.preventDefault()} className="rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/60 p-10 text-center">
            <p className="font-semibold text-slate-800">把试卷拖到这里，或一次选择多个文件</p>
            <p className="mt-2 text-xs text-slate-500">支持 PDF、Word 和 HTML；单次最多 50 个文件。</p>
            <label className="mt-5 inline-flex cursor-pointer rounded-md bg-[#e07a5f] px-4 py-2 text-sm font-medium text-white">
              选择文件
              <Input className="hidden" type="file" accept=".pdf,.doc,.docx,.html,.htm" multiple onChange={chooseFiles} />
            </label>
          </div>
        )}
        {state === "analyzing" && <div className="py-12 text-center text-sm text-slate-500">正在根据文件名整理标题、标签和版本关系…</div>}
        {(state === "organize" || state === "uploading") && (
          <div className="space-y-4">
            {message && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>}
            {groups.map((group, index) => (
              <ResourceGroupEditor
                key={group.groupKey}
                group={group}
                courses={availableCourses}
                onChange={(next) => updateGroup(index, next)}
                onSplit={(fileIndex) => splitFile(index, fileIndex)}
                mergeTargets={groups.filter((candidate) => candidate.groupKey !== group.groupKey).map((candidate) => ({ groupKey: candidate.groupKey, title: candidate.title }))}
                onMerge={(targetKey) => setGroups((current) => mergeUploadGroup(current, group.groupKey, targetKey))}
              />
            ))}
            <div className="flex justify-between gap-3">
              <Button variant="outline" type="button" disabled={state === "uploading"} onClick={() => { reset(); setState("select"); }}>重新选择</Button>
              <Button type="button" disabled={state === "uploading"} onClick={() => void upload()}>{duplicateConfirmed ? "确认重复并上传" : "确认并上传"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
