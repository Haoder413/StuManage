"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function StudentCommunicationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [method, setMethod] = useState("phone");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch(`/api/students`).then((r) => r.json()).then((students) => {
      setStudent(students.find((s: any) => s.id === params.id));
    });
    fetchLogs();
  }, [params.id]);

  async function fetchLogs() {
    const res = await fetch(`/api/communication?studentId=${params.id}`);
    if (res.ok) setLogs(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: params.id, method, content, date: new Date().toISOString() }),
    });
    if (res.ok) {
      setContent("");
      fetchLogs();
    }
  }

  if (!student) return <div>加载中...</div>;

  return (
    <div>
      <PageHeader title={`${student.name} · 沟通记录`} description="与家长的全部沟通历史" />
      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <Card>
          <CardHeader><CardTitle>添加记录</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>方式</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">电话</SelectItem>
                    <SelectItem value="wechat">微信</SelectItem>
                    <SelectItem value="in_person">面谈</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>内容</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">保存记录</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>历史记录</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400">暂无记录</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div key={log.id} className="border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <span>{new Date(log.date).toLocaleDateString("zh-CN")}</span>
                      <span>·</span>
                      <span>{log.method === "phone" ? "电话" : log.method === "wechat" ? "微信" : "面谈"}</span>
                    </div>
                    <p className="text-sm">{log.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
