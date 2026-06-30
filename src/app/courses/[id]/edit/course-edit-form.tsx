"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAY_OPTIONS = [
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
  { value: "0", label: "周日" },
];

interface Student {
  id: string;
  name: string;
  grade: string | null;
}

interface CourseFormData {
  id: string;
  name: string;
  description: string | null;
  type: string;
  defaultCapacity: number | null;
  selectedStudentIds: string[];
  scheduleTimes: Array<{ dayOfWeek: number; startTime: string; endTime: string; startDate: string | null; endDate: string | null }>;
}

function formatDateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function buildInitialScheduleTimes(scheduleTimes: CourseFormData["scheduleTimes"]) {
  if (scheduleTimes.length === 0) {
    return [{ selectedDays: ["1"], startTime: "09:00", endTime: "10:00", startDate: "", endDate: "" }];
  }

  const grouped = new Map<string, { selectedDays: string[]; startTime: string; endTime: string; startDate: string; endDate: string }>();
  scheduleTimes.forEach((time) => {
    const startDate = formatDateValue(time.startDate);
    const endDate = formatDateValue(time.endDate);
    const key = [time.startTime, time.endTime, startDate, endDate].join("|");
    const existing = grouped.get(key);
    if (existing) {
      existing.selectedDays.push(String(time.dayOfWeek));
      return;
    }
    grouped.set(key, {
      selectedDays: [String(time.dayOfWeek)],
      startTime: time.startTime,
      endTime: time.endTime,
      startDate,
      endDate,
    });
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    selectedDays: WEEKDAY_OPTIONS.map((day) => day.value).filter((day) => item.selectedDays.includes(day)),
  }));
}

export function CourseEditForm({ course, students }: { course: CourseFormData; students: Student[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(course.type === "custom" ? "custom" : "fixed");
  const [defaultCapacity, setDefaultCapacity] = useState(course.defaultCapacity ? String(course.defaultCapacity) : "");
  const [scheduleTimes, setScheduleTimes] = useState(buildInitialScheduleTimes(course.scheduleTimes));
  const [selectedStudentIds, setSelectedStudentIds] = useState(course.selectedStudentIds);

  function handleTypeChange(value: string) {
    setType(value);
    if (value === "custom") setSelectedStudentIds((prev) => prev.slice(0, 1));
  }

  function updateScheduleTime(index: number, field: "startTime" | "endTime" | "startDate" | "endDate", value: string) {
    setScheduleTimes((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function toggleScheduleDay(index: number, day: string) {
    setScheduleTimes((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const selectedDays = item.selectedDays.includes(day)
        ? item.selectedDays.filter((value) => value !== day)
        : [...item.selectedDays, day];
      return { ...item, selectedDays };
    }));
  }

  function setScheduleDays(index: number, selectedDays: string[]) {
    setScheduleTimes((prev) => prev.map((item, i) => i === index ? { ...item, selectedDays } : item));
  }

  function addScheduleTime() {
    setScheduleTimes((prev) => [...prev, { selectedDays: ["1"], startTime: "09:00", endTime: "10:00", startDate: "", endDate: "" }]);
  }

  function removeScheduleTime(index: number) {
    setScheduleTimes((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      if (type === "custom") return prev.includes(studentId) ? [] : [studentId];
      return prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId];
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      id: course.id,
      name: form.get("name") as string,
      description: form.get("description") as string,
      type,
      defaultCapacity: type === "custom" ? 1 : defaultCapacity ? Number(defaultCapacity) : null,
      studentIds: type === "custom" ? selectedStudentIds.slice(0, 1) : selectedStudentIds,
      scheduleTimes: scheduleTimes.map((item) => ({
        dayOfWeeks: item.selectedDays.map(Number),
        startTime: item.startTime,
        endTime: item.endTime,
        startDate: item.startDate,
        endDate: item.endDate,
      })),
    };

    try {
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.push(`/courses/${course.id}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href={`/courses/${course.id}`}>
          <Button variant="outline" size="sm">返回</Button>
        </Link>
      </div>
      <PageHeader title="编辑课程" description="修改课程信息、学生和上课时间" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div>
              <Label htmlFor="name">课程名称</Label>
              <Input id="name" name="name" required defaultValue={course.name} placeholder="如：初一数学培优班" />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input id="description" name="description" defaultValue={course.description || ""} placeholder="课程简要说明" />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定课程</SelectItem>
                  <SelectItem value="custom">定制课程</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="defaultCapacity">默认人数</Label>
              <Input
                id="defaultCapacity"
                name="defaultCapacity"
                type="number"
                min="1"
                value={type === "custom" ? "1" : defaultCapacity}
                onChange={(e) => setDefaultCapacity(e.target.value)}
                disabled={type === "custom"}
                placeholder="固定课程可填写班级人数"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>选择学生</Label>
                {selectedStudentIds.length > 0 && (
                  <span className="text-xs text-[#1a1a2e]/40">已选 {selectedStudentIds.length} 人</span>
                )}
              </div>
              {students.length === 0 ? (
                <p className="rounded-lg border border-[#1a1a2e]/10 px-3 py-2 text-sm text-[#1a1a2e]/40">暂无学生可选</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {students.map((student) => {
                    const active = selectedStudentIds.includes(student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${active ? "border-[#e07a5f] bg-[#e07a5f]/10 text-[#e07a5f]" : "border-[#1a1a2e]/10 text-[#1a1a2e]/60 hover:bg-white/70"}`}
                      >
                        {student.name}{student.grade ? ` · ${student.grade}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
              {type === "custom" && <p className="text-xs text-[#1a1a2e]/40">定制课程默认 1 人，只能选择一个学生。</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>课程时间</Label>
                <Button type="button" variant="outline" size="sm" onClick={addScheduleTime}>新增时间</Button>
              </div>
              <div className="space-y-2">
                {scheduleTimes.map((item, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-[#1a1a2e]/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-gray-500">上课日</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setScheduleDays(index, ["1", "2", "3", "4", "5"])}>工作日</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => removeScheduleTime(index)} disabled={scheduleTimes.length === 1}>删除</Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const active = item.selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleScheduleDay(index, day.value)}
                            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${active ? "border-[#e07a5f] bg-[#e07a5f]/10 text-[#e07a5f]" : "border-[#1a1a2e]/10 text-[#1a1a2e]/60 hover:bg-white/70"}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label className="text-xs text-gray-500">开始时间</Label>
                        <Input type="time" value={item.startTime} onChange={(e) => updateScheduleTime(index, "startTime", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">结束时间</Label>
                        <Input type="time" value={item.endTime} onChange={(e) => updateScheduleTime(index, "endTime", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">开始日期</Label>
                        <Input type="date" value={item.startDate} onChange={(e) => updateScheduleTime(index, "startDate", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">截止日期</Label>
                        <Input type="date" value={item.endDate} onChange={(e) => updateScheduleTime(index, "endDate", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>保存修改</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
