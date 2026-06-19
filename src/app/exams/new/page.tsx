"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function NewExamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [type, setType] = useState("quiz");
  const [scores, setScores] = useState<Record<string, { score: string; total: string }>>({});

  useEffect(() => {
    fetch("/api/students").then((r) => r.json()).then(setStudents);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const examName = form.get("name") as string;
    const examDate = form.get("date") as string;

    for (const student of students) {
      const s = scores[student.id];
      if (s?.score) {
        await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: student.id,
            name: examName,
            type,
            score: parseFloat(s.score),
            totalScore: parseFloat(s.total) || 100,
            date: new Date(examDate).toISOString(),
          }),
        });
      }
    }
    setLoading(false);
    router.push("/exams");
    router.refresh();
  }

  function updateScore(studentId: string, field: "score" | "total", value: string) {
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId] || { score: "", total: "100" }, [field]: value },
    }));
  }

  return (
    <div>
      <PageHeader title="新建考试" description="录入考试成绩" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name">考试名称</Label>
                <Input id="name" name="name" required placeholder="如：入学摸底" />
              </div>
              <div>
                <Label>类型</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrance">摸底</SelectItem>
                    <SelectItem value="monthly">阶段测试</SelectItem>
                    <SelectItem value="quiz">随堂测验</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">日期</Label>
                <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
            </div>

            <div>
              <Label>学生成绩</Label>
              <div className="border rounded-lg mt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="p-2 text-left font-medium">学生</th>
                      <th className="p-2 text-left font-medium w-24">得分</th>
                      <th className="p-2 text-left font-medium w-24">满分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="p-2">{s.name}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="得分"
                            value={scores[s.id]?.score || ""}
                            onChange={(e) => updateScore(s.id, "score", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="满分"
                            value={scores[s.id]?.total || "100"}
                            onChange={(e) => updateScore(s.id, "total", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>保存成绩</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
