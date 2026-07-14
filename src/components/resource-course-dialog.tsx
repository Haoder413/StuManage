"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CourseOption } from "@/types/resource-library";

export function ResourceCourseDialog({
  groupIds,
  courses,
  workspaceId,
  onSaved,
  endpoint = "/api/resource-groups/batch-courses",
}: {
  groupIds: string[];
  courses: CourseOption[];
  workspaceId?: string;
  onSaved: () => void;
  endpoint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const visibleCourses = useMemo(
    () => workspaceId ? courses.filter((course) => course.workspaceId === workspaceId) : courses,
    [courses, workspaceId]
  );

  async function save() {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupIds,
        addCourseIds: mode === "add" ? selectedIds : [],
        removeCourseIds: mode === "remove" ? selectedIds : [],
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage("课程授权保存失败，请检查所选资料是否属于同一工作区。");
      return;
    }
    setOpen(false);
    setSelectedIds([]);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={groupIds.length === 0}>课程分发</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量课程分发</DialogTitle>
          <DialogDescription>已选择 {groupIds.length} 套资料。加入课程后，家长可查看学生版和答案版全部文件。</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "add" ? "secondary" : "outline"} onClick={() => setMode("add")}>添加到课程</Button>
          <Button type="button" size="sm" variant={mode === "remove" ? "secondary" : "outline"} onClick={() => setMode("remove")}>从课程移除</Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
          {visibleCourses.length === 0 ? <p className="text-sm text-slate-400">暂无可选课程</p> : visibleCourses.map((course) => (
            <label key={course.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selectedIds.includes(course.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id))} />
              {course.name}
            </label>
          ))}
        </div>
        {message && <p className="text-sm text-rose-600">{message}</p>}
        <Button type="button" disabled={saving || selectedIds.length === 0} onClick={() => void save()}>{saving ? "保存中…" : "保存课程分发"}</Button>
      </DialogContent>
    </Dialog>
  );
}
