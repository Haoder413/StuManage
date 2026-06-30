"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Course = { id: string; name: string };

export default function NewHomeworkPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/homework", { method: "POST", body: formData });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "保存失败");
      return;
    }
    router.push(`/homework/${data.id}/review-structure`);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">新建作业</h1>
        <Link href="/homework"><Button variant="outline">返回</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>作业信息</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-600">
              课程
              <select name="courseId" required className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2">
                <option value="">选择课程</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-600">标题<Input name="title" required className="mt-1" /></label>
            <label className="block text-sm font-medium text-slate-600">说明<Input name="description" className="mt-1" /></label>
            <label className="block text-sm font-medium text-slate-600">截止时间<Input name="dueAt" type="datetime-local" className="mt-1" /></label>
            <label className="block text-sm font-medium text-slate-600">题目文件（推荐 Word，支持 PDF）<Input name="questionFile" type="file" accept=".doc,.docx,.pdf" required className="mt-1" /></label>
            <label className="block text-sm font-medium text-slate-600">答案/解析文件（推荐 Word，支持 PDF）<Input name="answerFile" type="file" accept=".doc,.docx,.pdf" required className="mt-1" /></label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button disabled={saving}>{saving ? "保存中..." : "保存并识别"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
