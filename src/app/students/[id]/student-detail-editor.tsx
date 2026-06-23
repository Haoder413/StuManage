"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StudentInfo {
  id: string;
  name: string;
  grade: string | null;
  parentContact: string | null;
  enrollmentDate: string;
  lessonFrequency: string | null;
  tuition: number | null;
  totalLessonHours: number;
  remainingLessonHours: number;
  notes: string | null;
  courseId: string;
}

interface CourseOption {
  id: string;
  name: string;
  type: string;
  scheduleTimes: { dayOfWeek: number; startTime: string; endTime: string }[];
}

interface CommunicationLog {
  id: string;
  date: string;
  method: string;
  content: string;
}

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function methodLabel(method: string) {
  const labels: Record<string, string> = { phone: "电话", wechat: "微信", in_person: "面谈" };
  return labels[method] || method;
}

export function StudentDetailEditor({
  initialStudent,
  courses,
  initialLogs,
}: {
  initialStudent: StudentInfo;
  courses: CourseOption[];
  initialLogs: CommunicationLog[];
}) {
  const [student, setStudent] = useState(initialStudent);
  const [logs, setLogs] = useState(initialLogs);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null);

  const [studentForm, setStudentForm] = useState({
    name: initialStudent.name,
    grade: initialStudent.grade || "",
    parentContact: initialStudent.parentContact || "",
    enrollmentDate: formatDateInput(initialStudent.enrollmentDate),
    lessonFrequency: initialStudent.lessonFrequency || "",
    tuition: initialStudent.tuition?.toString() || "",
    totalLessonHours: initialStudent.totalLessonHours?.toString() || "0",
    remainingLessonHours: initialStudent.remainingLessonHours?.toString() || "0",
    notes: initialStudent.notes || "",
    courseId: initialStudent.courseId || "none",
  });

  const [logForm, setLogForm] = useState({
    method: "wechat",
    date: "",
    content: "",
  });

  function openStudentDialog() {
    setStudentForm({
      name: student.name,
      grade: student.grade || "",
      parentContact: student.parentContact || "",
      enrollmentDate: formatDateInput(student.enrollmentDate),
      lessonFrequency: student.lessonFrequency || "",
      tuition: student.tuition?.toString() || "",
      totalLessonHours: student.totalLessonHours?.toString() || "0",
      remainingLessonHours: student.remainingLessonHours?.toString() || "0",
      notes: student.notes || "",
      courseId: student.courseId || "none",
    });
    setShowStudentDialog(true);
  }

  function openLogDialog(log: CommunicationLog) {
    setEditingLog(log);
    setLogForm({
      method: log.method,
      date: formatDateInput(log.date),
      content: log.content,
    });
  }

  async function saveStudent() {
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, ...studentForm }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStudent({
        id: updated.id,
        name: updated.name,
        grade: updated.grade,
        parentContact: updated.parentContact,
        enrollmentDate: updated.enrollmentDate,
        lessonFrequency: updated.lessonFrequency,
        tuition: updated.tuition,
        totalLessonHours: updated.totalLessonHours,
        remainingLessonHours: updated.remainingLessonHours,
        notes: updated.notes,
        courseId: updated.studentCourses?.[0]?.courseId || "none",
      });
      setShowStudentDialog(false);
    }
  }

  async function saveLog() {
    if (!editingLog) return;
    const res = await fetch("/api/communication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingLog.id, ...logForm }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLogs(prev => prev.map(log => log.id === updated.id ? {
        id: updated.id,
        method: updated.method,
        content: updated.content,
        date: updated.date,
      } : log));
      setEditingLog(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>基本信息</CardTitle>
            <Button variant="outline" size="sm" onClick={openStudentDialog}>编辑基本信息</Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">姓名</span><span className="text-[#1a1a2e]/70">{student.name}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">年级</span><span className="text-[#1a1a2e]/70">{student.grade || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">家长联系方式</span><span className="text-[#1a1a2e]/70">{student.parentContact || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">入学日期</span><span className="text-[#1a1a2e]/70">{new Date(student.enrollmentDate).toLocaleDateString("zh-CN")}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">上课频次</span><span className="text-[#1a1a2e]/70">{student.lessonFrequency || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">学费</span><span className="text-[#1a1a2e]/70">{student.tuition ? `¥${student.tuition.toFixed(2)}` : "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">总课时</span><span className="text-[#1a1a2e]/70">{student.totalLessonHours}</span></div>
            <div className="flex justify-between"><span className="text-[#1a1a2e]/40">剩余课时</span><span className="text-[#1a1a2e]/70">{student.remainingLessonHours}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#1a1a2e]/40">所属课程</span><span className="text-[#1a1a2e]/70 text-right">{courses.find(course => course.id === student.courseId)?.name || "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#1a1a2e]/40">备注</span><span className="text-[#1a1a2e]/70 text-right">{student.notes || "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>最近沟通记录</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-[#1a1a2e]/30">暂无记录</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="text-sm border-b border-[#1a1a2e]/5 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#1a1a2e]/40 text-xs">{new Date(log.date).toLocaleDateString("zh-CN")} · {methodLabel(log.method)}</span>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openLogDialog(log)}>编辑沟通记录</Button>
                    </div>
                    <p className="text-[#1a1a2e]/70 mt-0.5">{log.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>编辑基本信息</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">姓名</Label>
              <Input value={studentForm.name} onChange={e => setStudentForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">年级</Label>
              <Input value={studentForm.grade} onChange={e => setStudentForm(prev => ({ ...prev, grade: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">家长联系方式</Label>
              <Input value={studentForm.parentContact} onChange={e => setStudentForm(prev => ({ ...prev, parentContact: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">入学日期</Label>
              <Input type="date" value={studentForm.enrollmentDate} onChange={e => setStudentForm(prev => ({ ...prev, enrollmentDate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">上课频次</Label>
              <Input value={studentForm.lessonFrequency} onChange={e => setStudentForm(prev => ({ ...prev, lessonFrequency: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">学费</Label>
              <Input type="number" value={studentForm.tuition} onChange={e => setStudentForm(prev => ({ ...prev, tuition: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">总课时</Label>
              <Input type="number" min="0" value={studentForm.totalLessonHours} onChange={e => setStudentForm(prev => ({ ...prev, totalLessonHours: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">剩余课时</Label>
              <Input type="number" min="0" value={studentForm.remainingLessonHours} onChange={e => setStudentForm(prev => ({ ...prev, remainingLessonHours: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">选择课程</Label>
              <Select value={studentForm.courseId} onValueChange={courseId => setStudentForm(prev => ({ ...prev, courseId }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不选择课程</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}（{course.type === "fixed" ? "固定课程" : "定制课程"}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studentForm.courseId !== "none" && (
                <p className="mt-1 text-xs text-[#1a1a2e]/40">
                  {courses.find(course => course.id === studentForm.courseId)?.scheduleTimes.map((time) => `周${["日", "一", "二", "三", "四", "五", "六"][time.dayOfWeek]} ${time.startTime}-${time.endTime}`).join("、") || "暂无课程时间"}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">备注</Label>
              <Textarea value={studentForm.notes} onChange={e => setStudentForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowStudentDialog(false)}>取消</Button>
            <Button size="sm" onClick={saveStudent} disabled={!studentForm.name.trim()}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingLog)} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>编辑沟通记录</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">方式</Label>
                <Select value={logForm.method} onValueChange={method => setLogForm(prev => ({ ...prev, method }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wechat">微信</SelectItem>
                    <SelectItem value="phone">电话</SelectItem>
                    <SelectItem value="in_person">面谈</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">日期</Label>
                <Input type="date" value={logForm.date} onChange={e => setLogForm(prev => ({ ...prev, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">内容</Label>
              <Textarea value={logForm.content} onChange={e => setLogForm(prev => ({ ...prev, content: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingLog(null)}>取消</Button>
            <Button size="sm" onClick={saveLog} disabled={!logForm.content.trim()}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
