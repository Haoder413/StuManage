"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface Student {
  id: string;
  name: string;
  grade: string | null;
}

export default function NewCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("fixed");
  const [defaultCapacity, setDefaultCapacity] = useState("");
  const [scheduleTimes, setScheduleTimes] = useState([{ dayOfWeek: "1", startTime: "09:00", endTime: "10:00" }]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/students")
      .then((res) => res.json())
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  function handleTypeChange(value: string) {
    setType(value);
    if (value === "custom") {
      setSelectedStudentIds(prev => prev.slice(0, 1));
    }
  }

  function updateScheduleTime(index: number, field: "dayOfWeek" | "startTime" | "endTime", value: string) {
    setScheduleTimes(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addScheduleTime() {
    setScheduleTimes(prev => [...prev, { dayOfWeek: "1", startTime: "09:00", endTime: "10:00" }]);
  }

  function removeScheduleTime(index: number) {
    setScheduleTimes(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds(prev => {
      if (type === "custom") return prev.includes(studentId) ? [] : [studentId];
      return prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId];
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      description: form.get("description") as string,
      type,
      defaultCapacity: type === "custom" ? 1 : defaultCapacity ? Number(defaultCapacity) : null,
      studentIds: type === "custom" ? selectedStudentIds.slice(0, 1) : selectedStudentIds,
      scheduleTimes: scheduleTimes.map((item) => ({
        dayOfWeek: Number(item.dayOfWeek),
        startTime: item.startTime,
        endTime: item.endTime,
      })),
    };

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.push("/courses");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="新增课程" description="创建一个新的课程" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div>
              <Label htmlFor="name">课程名称</Label>
              <Input id="name" name="name" required placeholder="如：初一数学培优班" />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input id="description" name="description" placeholder="课程简要说明" />
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
                {selectedStudentIds.length > 0 && <span className="text-xs text-[#1a1a2e]/40">已选 {selectedStudentIds.length} 人</span>}
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
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 rounded-lg border border-[#1a1a2e]/10 p-3">
                    <div>
                      <Label className="text-xs text-gray-500">星期</Label>
                      <Select value={item.dayOfWeek} onValueChange={(value) => updateScheduleTime(index, "dayOfWeek", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[["1", "周一"], ["2", "周二"], ["3", "周三"], ["4", "周四"], ["5", "周五"], ["6", "周六"], ["0", "周日"]].map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">开始时间</Label>
                      <Input type="time" value={item.startTime} onChange={(e) => updateScheduleTime(index, "startTime", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">结束时间</Label>
                      <Input type="time" value={item.endTime} onChange={(e) => updateScheduleTime(index, "endTime", e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => removeScheduleTime(index)} disabled={scheduleTimes.length === 1}>删除</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>保存</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
