"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STUDENT_GRADE_OPTIONS } from "@/lib/student-grades";

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState("none");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      grade: grade === "none" ? "" : grade,
      parentContact: form.get("parentContact") as string,
      enrollmentDate: new Date(form.get("enrollmentDate") as string).toISOString(),
      lessonFrequency: form.get("lessonFrequency") as string,
      tuition: form.get("tuition") ? parseFloat(form.get("tuition") as string) : null,
      notes: form.get("notes") as string,
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
            <div>
              <Label>年级</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不设置年级</SelectItem>
                  {STUDENT_GRADE_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="parentContact">家长联系方式</Label><Input id="parentContact" name="parentContact" placeholder="手机号" /></div>
            <div><Label htmlFor="enrollmentDate">入学日期</Label><Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
            <div><Label htmlFor="lessonFrequency">上课频次</Label><Input id="lessonFrequency" name="lessonFrequency" placeholder="如：每周2次" /></div>
            <div><Label htmlFor="tuition">学费</Label><Input id="tuition" name="tuition" type="number" step="0.01" placeholder="如：3000" /></div>
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
