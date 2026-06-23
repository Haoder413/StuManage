"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Course {
  id: string;
  name: string;
  type: string;
  scheduleTimes?: { dayOfWeek: number; startTime: string; endTime: string }[];
}

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("none");

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      grade: form.get("grade") as string,
      parentContact: form.get("parentContact") as string,
      enrollmentDate: new Date(form.get("enrollmentDate") as string).toISOString(),
      lessonFrequency: form.get("lessonFrequency") as string,
      tuition: form.get("tuition") ? parseFloat(form.get("tuition") as string) : null,
      notes: form.get("notes") as string,
      courseId: courseId === "none" ? null : courseId,
    };
    try {
      const res = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { router.push("/students"); router.refresh(); }
    } finally { setLoading(false); }
  }

  return (
    <div>
      <PageHeader title="新增学生" description="添加一个新的学生档案" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div><Label htmlFor="name">姓名</Label><Input id="name" name="name" required /></div>
            <div><Label htmlFor="grade">年级</Label><Input id="grade" name="grade" placeholder="如：初一" /></div>
            <div><Label htmlFor="parentContact">家长联系方式</Label><Input id="parentContact" name="parentContact" placeholder="手机号" /></div>
            <div><Label htmlFor="enrollmentDate">入学日期</Label><Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
            <div><Label htmlFor="lessonFrequency">上课频次</Label><Input id="lessonFrequency" name="lessonFrequency" placeholder="如：每周2次" /></div>
            <div><Label htmlFor="tuition">学费</Label><Input id="tuition" name="tuition" type="number" step="0.01" placeholder="如：3000" /></div>
            <div>
              <Label>选择课程</Label>
              <Select name="courseId" value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不选择课程</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}（{course.type === "fixed" ? "固定课程" : "定制课程"}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {courseId !== "none" && (
              <p className="rounded-lg border border-[#1a1a2e]/10 px-3 py-2 text-xs text-[#1a1a2e]/50">
                {courses.find(course => course.id === courseId)?.scheduleTimes?.map((time) => `周${["日", "一", "二", "三", "四", "五", "六"][time.dayOfWeek]} ${time.startTime}-${time.endTime}`).join("、") || "该课程暂无固定时间"}
              </p>
            )}
            <div><Label htmlFor="notes">备注</Label><textarea id="notes" name="notes" className="flex min-h-[80px] w-full rounded-md border border-[#1a1a2e]/10 bg-white/50 px-3 py-2 text-sm" /></div>
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
