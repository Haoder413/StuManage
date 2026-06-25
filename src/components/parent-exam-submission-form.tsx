"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ParentLearningLink = {
  id: string;
  label: string;
  studentId: string;
};

export function ParentExamSubmissionForm({ learningLinks }: { learningLinks: ParentLearningLink[] }) {
  const [learningLinkId, setLearningLinkId] = useState(learningLinks[0]?.id || "");
  const [type, setType] = useState("monthly");
  const [message, setMessage] = useState("");

  async function submitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const link = learningLinks.find((item) => item.id === learningLinkId);
    if (!link) {
      setMessage("请选择学习关系");
      return;
    }
    const response = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learningLinkId,
        studentId: link.studentId,
        name: form.get("name"),
        type,
        score: form.get("score"),
        totalScore: form.get("totalScore"),
        date: form.get("date"),
        notes: form.get("notes"),
      }),
    });
    setMessage(response.ok ? "已提交，等待老师审核" : "提交失败，请稍后重试");
    if (response.ok) formElement.reset();
  }

  if (learningLinks.length === 0) {
    return <p className="text-sm text-slate-400">暂无可提交成绩的学习关系</p>;
  }

  return (
    <form onSubmit={submitExam} className="grid gap-3 md:grid-cols-7">
      <Select value={learningLinkId} onValueChange={setLearningLinkId}>
        <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
        <SelectContent>
          {learningLinks.map((link) => (
            <SelectItem key={link.id} value={link.id}>{link.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="name" placeholder="考试名称" required />
      <Select value={type} onValueChange={setType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="entrance">摸底</SelectItem>
          <SelectItem value="monthly">阶段测试</SelectItem>
          <SelectItem value="quiz">随堂测验</SelectItem>
        </SelectContent>
      </Select>
      <Input name="score" placeholder="得分" required type="number" step="0.1" />
      <Input name="totalScore" placeholder="满分" defaultValue="100" type="number" step="0.1" />
      <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
      <Input name="notes" placeholder="备注" className="md:col-span-6" />
      <Button type="submit">提交成绩</Button>
      {message && <p className="md:col-span-7 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>}
    </form>
  );
}
