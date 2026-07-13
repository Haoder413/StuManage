"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentOption = { id: string; name: string; grade: string | null };

export function StudentReportSelector({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [version, setVersion] = useState<"parent" | "internal">("parent");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = Boolean(from && to && from > to);

  function openReport() {
    if (!studentId || invalidRange) return;
    const params = new URLSearchParams({ version });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/reports/students/${studentId}?${params.toString()}`);
  }

  return (
    <div className="grid max-w-3xl gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader><CardTitle>生成学习报告</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="report-student">学生</Label>
            <select
              id="report-student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {students.length === 0 && <option value="">暂无可导出学生</option>}
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}{student.grade ? ` · ${student.grade}` : ""}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">报告版本</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: "parent", title: "家长版", description: "学习、成绩、作业与课堂反馈" },
                { value: "internal", title: "教师内部版", description: "额外包含课时、费用和内部备注" },
              ].map((item) => (
                <label key={item.value} className={`cursor-pointer rounded-lg border p-3 ${version === item.value ? "border-sky-500 bg-sky-50" : "border-gray-200"}`}>
                  <input
                    type="radio"
                    name="version"
                    value={item.value}
                    checked={version === item.value}
                    onChange={() => setVersion(item.value as "parent" | "internal")}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">{item.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div>
              <Label>统计时间范围</Label>
              <p className="text-xs text-gray-400">两项留空时导出全部历史</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="report-from" className="text-xs text-gray-500">开始日期</Label><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
              <div><Label htmlFor="report-to" className="text-xs text-gray-500">结束日期</Label><Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
            </div>
            {invalidRange && <p className="text-xs font-medium text-red-600">开始日期不能晚于结束日期</p>}
          </div>

          <Button onClick={openReport} disabled={!studentId || invalidRange}>预览并导出 PDF</Button>
        </CardContent>
      </Card>

      <Card className="h-fit bg-slate-50/70">
        <CardHeader><CardTitle className="!text-base">报告包含</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            {["学习概览与课程", "课堂、考勤与教师反馈", "已审核考试成绩", "作业提交与批改", "知识点进度", "薄弱点与复习情况"].map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
