"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Question = { id?: string; number: string; type: string; score: number; standardAnswer: string; explanation: string };
type Assignment = { id: string; title: string; status: string; questions: Question[] };
type QuestionCounts = { blank: string; choice: string; essay: string; calculation: string };

export default function HomeworkStructurePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [counts, setCounts] = useState<QuestionCounts>({ blank: "", choice: "", essay: "", calculation: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/homework/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setAssignment(data);
        setQuestions((data.questions || []).map((q: Question) => ({
          id: q.id,
          number: q.number,
          type: q.type,
          score: q.score,
          standardAnswer: q.standardAnswer || "",
          explanation: q.explanation || "",
        })));
      });
  }, [params.id]);

  function updateQuestion(index: number, field: keyof Question, value: string) {
    setQuestions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "score" ? Number(value) : value } : item));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { number: String(prev.length + 1), type: "其他", score: 0, standardAnswer: "", explanation: "" }]);
  }

  async function saveQuestions() {
    setMessage("");
    const res = await fetch(`/api/homework/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-questions", questions }),
    });
    setMessage(res.ok ? "题目结构已保存" : "保存失败");
  }

  function updateCount(field: keyof QuestionCounts, value: string) {
    const normalized = value.replace(/[^\d]/g, "");
    setCounts((prev) => ({ ...prev, [field]: normalized }));
  }

  function generateQuestionsFromCounts() {
    const groups = [
      { type: "填空", count: Number(counts.blank || 0) },
      { type: "选择", count: Number(counts.choice || 0) },
      { type: "解答", count: Number(counts.essay || 0) },
      { type: "计算", count: Number(counts.calculation || 0) },
    ];
    const generated: Question[] = [];
    for (const group of groups) {
      for (let index = 0; index < group.count; index++) {
        generated.push({
          number: String(generated.length + 1),
          type: group.type,
          score: 0,
          standardAnswer: "",
          explanation: "",
        });
      }
    }
    setQuestions(generated);
    setMessage(`已生成 ${generated.length} 道题目结构`);
  }

  async function publish() {
    await saveQuestions();
    const res = await fetch(`/api/homework/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    if (res.ok) router.push(`/homework/${params.id}`);
    else setMessage("发布失败");
  }

  if (!assignment) return <p className="text-sm text-slate-400">加载中...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">核对题目结构</h1>
          <p className="text-sm text-slate-500">{assignment.title}</p>
        </div>
        <Link href={`/homework/${assignment.id}`}><Button variant="outline">返回详情</Button></Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>题目结构</CardTitle>
          <Button type="button" variant="outline" onClick={addQuestion}>新增题目</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">按题型数量生成</h2>
              <p className="text-xs text-slate-500">这里不再自动识别 Word。老师填写各题型数量后，系统按顺序生成题号和题型，生成后仍可微调分值。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <label className="text-xs font-medium text-slate-500">填空题有几题<Input inputMode="numeric" value={counts.blank} onChange={(e) => updateCount("blank", e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-500">选择题有几题<Input inputMode="numeric" value={counts.choice} onChange={(e) => updateCount("choice", e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-500">大题有几题<Input inputMode="numeric" value={counts.essay} onChange={(e) => updateCount("essay", e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-500">计算题有几题<Input inputMode="numeric" value={counts.calculation} onChange={(e) => updateCount("calculation", e.target.value)} /></label>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={generateQuestionsFromCounts}>生成题目结构</Button>
              </div>
            </div>
          </div>
          {questions.map((question, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[80px_120px_100px_1fr_1fr]">
              <label className="text-xs text-slate-500">题号<Input value={question.number} onChange={(e) => updateQuestion(index, "number", e.target.value)} /></label>
              <label className="text-xs text-slate-500">题型
                <select value={question.type} onChange={(e) => updateQuestion(index, "type", e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm">
                  {["选择", "填空", "计算", "解答", "其他"].map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">分值<Input type="number" value={question.score} onChange={(e) => updateQuestion(index, "score", e.target.value)} /></label>
              <label className="text-xs text-slate-500">标准答案<Input value={question.standardAnswer} onChange={(e) => updateQuestion(index, "standardAnswer", e.target.value)} /></label>
              <label className="text-xs text-slate-500">解析<Input value={question.explanation} onChange={(e) => updateQuestion(index, "explanation", e.target.value)} /></label>
            </div>
          ))}
          {message && <p className="text-sm text-sky-600">{message}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={saveQuestions}>保存结构</Button>
            <Button type="button" onClick={publish}>确认发布</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
