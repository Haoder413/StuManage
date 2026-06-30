"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ExamWeakPointDialog, type ExamWeakPointTag } from "@/components/exam-weak-point-dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

const examTypeLabel: Record<string, string> = { entrance: "摸底", monthly: "阶段测试", quiz: "随堂小测" };
const typeOptions = [
  { value: "entrance", label: "摸底考试" },
  { value: "monthly", label: "阶段测试" },
  { value: "quiz", label: "随堂小测" },
];

interface Exam {
  id: string; name: string; type: string; score: number;
  totalScore: number; date: string; notes: string | null;
}

export default function StudentExamDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [student, setStudent] = useState<{ name: string; grade: string | null } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "quiz", score: "", totalScore: "100" });
  const [showForm, setShowForm] = useState(false);
  const [weakPointTags, setWeakPointTags] = useState<ExamWeakPointTag[]>([]);
  const [pendingNewExam, setPendingNewExam] = useState<{
    name: string;
    type: string;
    score: number;
    totalScore: number;
    date: string;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("quiz");
  const [newScore, setNewScore] = useState("");
  const [newTotal, setNewTotal] = useState("100");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    async function load() {
      const [studentsRes, examsRes, tagsRes] = await Promise.all([
        fetch("/api/students"), fetch(`/api/exams?studentId=${studentId}`),
        fetch("/api/weak-point-tags").catch(() => null),
      ]);
      const allStudents = await studentsRes.json();
      const found = allStudents.find((s: any) => s.id === studentId);
      if (found) setStudent({ name: found.name, grade: found.grade });
      const examsData: Exam[] = await examsRes.json();
      setExams(examsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      if (tagsRes?.ok) setWeakPointTags(await tagsRes.json());
      setLoading(false);
    }
    load();
  }, [studentId]);

  const formal = exams.filter(e => e.type !== "quiz");
  const quizzes = exams.filter(e => e.type === "quiz");
  const calcAvg = (list: Exam[]) => list.length > 0 ? Math.round(list.reduce((s, e) => s + (e.score / e.totalScore) * 100, 0) / list.length) : -1;
  const formalAvg = calcAvg(formal);
  const quizAvg = calcAvg(quizzes);
  const scores = exams.map(e => (e.score / e.totalScore) * 100);
  const maxScore = scores.length > 0 ? Math.round(Math.max(...scores)) : 0;
  const minScore = scores.length > 0 ? Math.round(Math.min(...scores)) : 0;
  const latestScore = scores.length > 0 ? Math.round(scores[scores.length - 1]) : 0;
  const firstScore = scores.length > 0 ? Math.round(scores[0]) : 0;
  const totalAvg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const improvement = latestScore - firstScore;

  // Combined chart data: formalScore and quizScore on same axis
  const chartData = exams.map(e => ({
    name: e.name,
    formalScore: e.type !== "quiz" ? Math.round((e.score / e.totalScore) * 100) : null,
    quizScore: e.type === "quiz" ? Math.round((e.score / e.totalScore) * 100) : null,
    type: examTypeLabel[e.type] || e.type,
  }));

  async function handleSaveExam(examId: string) {
    const val = parseFloat(editForm.score);
    const total = parseFloat(editForm.totalScore) || 100;
    if (isNaN(val) || val < 0) return;
    try {
      await fetch("/api/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: examId,
          name: editForm.name.trim(),
          type: editForm.type,
          score: val,
          totalScore: total,
        }),
      });
      setExams(prev => prev.map(e => e.id === examId ? { ...e, name: editForm.name.trim(), type: editForm.type, score: val, totalScore: total } : e));
    } catch (err) { console.error(err); }
    setEditingId(null);
  }

  function startEdit(exam: Exam) {
    setEditingId(exam.id);
    setEditForm({
      name: exam.name,
      type: exam.type,
      score: String(exam.score),
      totalScore: String(exam.totalScore),
    });
  }

  function handleAddExam() {
    if (!newName.trim() || !newScore) return;
    setPendingNewExam({
      name: newName.trim(),
      type: newType,
      score: parseFloat(newScore),
      totalScore: parseFloat(newTotal) || 100,
      date: new Date(newDate).toISOString(),
    });
  }

  async function savePendingNewExam(weakPointDescriptions: string[]) {
    if (!pendingNewExam) return;
    try {
      const res = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, ...pendingNewExam, weakPointDescriptions }),
      });
      if (res.ok) {
        const created = await res.json();
        setExams(prev => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewName(""); setNewScore(""); setNewTotal("100"); setNewType("quiz");
        setPendingNewExam(null);
      }
    } catch (err) { console.error(err); }
  }

  async function createWeakPointTag(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const existing = weakPointTags.find((tag) => tag.name === cleanName);
    if (existing) return existing;
    const res = await fetch("/api/weak-point-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, category: null }),
    });
    if (!res.ok) return null;
    const created = await res.json();
    setWeakPointTags((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")));
    return created as ExamWeakPointTag;
  }

  if (loading) return <div className="p-6"><PageHeader title="加载中..." /></div>;
  if (!student) return <div className="p-6"><PageHeader title="学生未找到" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/exams"><Button variant="outline" size="sm">← 返回</Button></Link>
      </div>
      <PageHeader title={`${student.name} · 成绩分析`} description={`${student.grade || ""} · 共 ${exams.length} 次考试`} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase">📝 正式考试均分</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formalAvg >= 0 ? `${formalAvg}%` : "-"}</p>
          <p className="text-[11px] text-gray-400">{formal.length} 次</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase">📋 小测平均分</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{quizAvg >= 0 ? `${quizAvg}%` : "-"}</p>
          <p className="text-[11px] text-gray-400">{quizzes.length} 次</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase">最高</p>
          <p className="text-lg font-bold text-green-500 mt-1">{maxScore}%</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase">最低</p>
          <p className="text-lg font-bold text-red-500 mt-1">{minScore}%</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase">进步幅度</p>
          <p className={`text-lg font-bold mt-1 ${improvement >= 0 ? "text-green-500" : "text-red-500"}`}>{improvement >= 0 ? "+" : ""}{improvement}%</p>
        </div>
      </div>

      {/* Add exam form */}
      <div className="glass-card rounded-xl p-5 mb-6">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-gray-900">📝 录入新成绩</h3>
          <span className={`text-gray-400 transition-transform ${showForm ? "rotate-180" : ""}`}>▼</span>
        </button>
        {showForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <div className="col-span-2">
                <Label className="text-xs text-gray-500">考试名称</Label>
                <Input placeholder="如：月考二" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">类型</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">得分</Label>
                <Input type="number" step="0.1" placeholder="如：85" value={newScore} onChange={e => setNewScore(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">满分</Label>
                <Input type="number" step="0.1" value={newTotal} onChange={e => setNewTotal(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">日期</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div className="col-span-2 md:col-span-6 flex justify-end">
                <Button onClick={handleAddExam} disabled={!newName.trim() || !newScore}>保存成绩</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart with two lines */}
      <div className="glass-card rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">成绩趋势图</h3>
        {exams.length < 2 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">至少需要两次考试才能显示趋势图</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#999" }} angle={-20} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#999" }} label={{ value: "得分率 %", angle: -90, position: "left", offset: 10, style: { fontSize: 12, fill: "#999" } }} />
                <Tooltip formatter={(value: number) => value != null ? `${value}%` : "-"} labelFormatter={(label) => `考试: ${label}`} />
                <Legend />
                <ReferenceLine y={totalAvg} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: `均分 ${totalAvg}%`, position: "right", style: { fontSize: 11, fill: "#94a3b8" } }} />
                <Line type="linear" dataKey="formalScore" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} name="📝 正式考试" connectNulls={true} />
                <Line type="linear" dataKey="quizScore" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }} name="📋 随堂小测" connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Exam list */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">考试明细 <span className="text-xs text-gray-400 font-normal ml-2">可修改考试名称、类型和分数</span></h3>
        {exams.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">暂无考试记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">考试名称</th>
                  <th className="p-3 font-semibold">类型</th>
                  <th className="p-3 font-semibold">得分</th>
                  <th className="p-3 font-semibold">得分率</th>
                  <th className="p-3 font-semibold">日期</th>
                  <th className="p-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {[...exams].reverse().map((e, idx) => {
                  const pct = Math.round((e.score / e.totalScore) * 100);
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-400 font-medium">{exams.length - idx}</td>
                      <td className="p-3 font-medium text-gray-900">
                        {isEditing ? (
                          <Input className="h-8 min-w-36 text-sm" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                        ) : e.name}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <Select value={editForm.type} onValueChange={(type) => setEditForm((current) => ({ ...current, type }))}>
                            <SelectTrigger className="h-8 min-w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs font-medium" style={{ color: e.type === "quiz" ? "#f59e0b" : "#3b82f6" }}>
                            {examTypeLabel[e.type] || e.type}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input type="number" step="0.1" className="w-20 h-8 text-sm" value={editForm.score}
                              onChange={event => setEditForm((current) => ({ ...current, score: event.target.value }))} />
                            <span className="text-gray-400 text-xs">/</span>
                            <Input type="number" step="0.1" className="w-20 h-8 text-sm" value={editForm.totalScore}
                              onChange={event => setEditForm((current) => ({ ...current, totalScore: event.target.value }))} />
                          </div>
                        ) : (
                          <button onClick={() => startEdit(e)} className="hover:text-blue-500 transition-colors text-left">
                            <span className="font-medium text-gray-700">{e.score}</span>
                            <span className="text-gray-400"> / {e.totalScore}</span>
                            <span className="ml-1 text-[10px] text-gray-300 hover:text-blue-400">✏️</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`font-semibold ${pct >= 80 ? "text-green-500" : pct >= 60 ? "text-orange-500" : "text-red-500"}`}>{pct}%</span>
                      </td>
                      <td className="p-3 text-gray-500">{new Date(e.date).toLocaleDateString("zh-CN")}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveExam(e.id)} disabled={!editForm.name.trim()}>保存</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEdit(e)}>编辑</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ExamWeakPointDialog
        open={Boolean(pendingNewExam)}
        title="保存成绩"
        description={pendingNewExam ? `${student.name} · ${pendingNewExam.name} · ${pendingNewExam.score}/${pendingNewExam.totalScore}` : ""}
        weakPointTags={weakPointTags}
        onClose={() => setPendingNewExam(null)}
        onCreateTag={createWeakPointTag}
        onSubmit={savePendingNewExam}
        submitLabel="保存成绩"
      />
    </div>
  );
}
