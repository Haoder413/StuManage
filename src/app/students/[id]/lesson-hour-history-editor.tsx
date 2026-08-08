"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type LessonHourLog = {
  id: string;
  type: string;
  deltaTotalHours: number;
  deltaRemainingHours: number;
  beforeTotalHours: number;
  afterTotalHours: number;
  beforeRemainingHours: number;
  afterRemainingHours: number;
  note: string | null;
  teacherFeedback: string | null;
  createdAt: string;
  attendance: {
    date: string;
    schedule: { startTime: string | null; endTime: string | null } | null;
  } | null;
};

const typeLabels: Record<string, string> = {
  manual_add: "增加课时",
  manual_use: "使用课时",
  attendance_present: "出勤扣课时",
  attendance_restore: "恢复课时",
};

const typeOptions = [
  { value: "manual_add", label: "增加课时" },
  { value: "manual_use", label: "使用课时" },
  { value: "attendance_present", label: "出勤扣课时" },
  { value: "attendance_restore", label: "恢复课时" },
];

function formatDateTimeInput(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function LessonHourHistoryEditor({
  isAdmin,
  initialLogs,
}: {
  isAdmin: boolean;
  initialLogs: LessonHourLog[];
}) {
  const [editingLog, setEditingLog] = useState<LessonHourLog | null>(null);
  const [form, setForm] = useState({
    type: "manual_add",
    deltaTotalHours: "0",
    deltaRemainingHours: "0",
    occurredAt: formatDateTimeInput(new Date().toISOString()),
    note: "",
    teacherFeedback: "",
  });
  const [saving, setSaving] = useState(false);

  function openEdit(log: LessonHourLog) {
    setEditingLog(log);
    setForm({
      type: log.type,
      deltaTotalHours: String(log.deltaTotalHours),
      deltaRemainingHours: String(log.deltaRemainingHours),
      occurredAt: formatDateTimeInput(log.createdAt),
      note: log.note || "",
      teacherFeedback: log.teacherFeedback || "",
    });
  }

  async function saveEdit() {
    if (!editingLog) return;
    setSaving(true);
    const response = await fetch(`/api/lesson-hour-logs/${editingLog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        deltaTotalHours: Number(form.deltaTotalHours) || 0,
        deltaRemainingHours: Number(form.deltaRemainingHours) || 0,
        occurredAt: form.occurredAt,
        note: form.note,
        teacherFeedback: form.teacherFeedback,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      alert("课时历史修改失败，请确认不会导致课时统计为负数。");
      return;
    }
    window.location.reload();
  }

  async function deleteLog(log: LessonHourLog) {
    if (!confirm("确定删除这条课时历史？学生课时统计会同步回滚。")) return;
    const response = await fetch(`/api/lesson-hour-logs/${log.id}`, { method: "DELETE" });
    if (!response.ok) {
      alert("课时历史删除失败，请确认不会导致课时统计为负数。");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>课时历史</CardTitle>
        </CardHeader>
        <CardContent>
          {initialLogs.length === 0 ? (
            <p className="text-sm text-[#1a1a2e]/30">暂无课时记录</p>
          ) : (
            <div className="space-y-3">
              {initialLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-[#1a1a2e]/5 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#1a1a2e]">
                      {typeLabels[log.type] || log.type}
                      <span className={log.deltaRemainingHours >= 0 ? "ml-2 text-green-600" : "ml-2 text-[#e07a5f]"}>
                        {log.deltaRemainingHours > 0 ? "+" : ""}{log.deltaRemainingHours}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#1a1a2e]/40">{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
                      {isAdmin && (
                        <>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(log)}>编辑</Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={() => deleteLog(log)}>删除</Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[#1a1a2e]/50">
                    剩余课时 {log.beforeRemainingHours} {"->"} {log.afterRemainingHours}
                    <span className="mx-2">·</span>
                    总课时 {log.beforeTotalHours} {"->"} {log.afterTotalHours}
                  </p>
                  {log.attendance?.schedule && (
                    <p className="mt-1 text-xs text-[#1a1a2e]/40">
                      {new Date(log.attendance.date).toLocaleDateString("zh-CN")} · {log.attendance.schedule.startTime || "待定"}{log.attendance.schedule.endTime ? `-${log.attendance.schedule.endTime}` : ""}
                    </p>
                  )}
                  {log.teacherFeedback && <p className="mt-1 text-xs text-[#1a1a2e]/60">{log.teacherFeedback}</p>}
                  {log.note && <p className="mt-1 text-xs text-[#1a1a2e]/40">备注：{log.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingLog)} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>编辑课时历史</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">类型</Label>
              <Select value={form.type} onValueChange={(type) => setForm(prev => ({ ...prev, type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">总课时变化</Label>
                <Input type="number" step="0.01" value={form.deltaTotalHours} onChange={e => setForm(prev => ({ ...prev, deltaTotalHours: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">剩余课时变化</Label>
                <Input type="number" step="0.01" value={form.deltaRemainingHours} onChange={e => setForm(prev => ({ ...prev, deltaRemainingHours: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">发生时间</Label>
              <Input type="datetime-local" value={form.occurredAt} onChange={e => setForm(prev => ({ ...prev, occurredAt: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">老师反馈</Label>
              <Textarea value={form.teacherFeedback} onChange={e => setForm(prev => ({ ...prev, teacherFeedback: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">备注</Label>
              <Textarea value={form.note} onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingLog(null)} disabled={saving}>取消</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
