"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Exam {
  id: string;
  studentId: string;
  learningLinkId: string | null;
  name: string;
  type: string;
  score: number;
  totalScore: number;
  date: string;
  reviewStatus: string;
  rejectionReason?: string | null;
  student: { id: string; name: string; grade: string | null };
  learningLink?: { teacher?: { name: string }; parent?: { name: string }; subject: string } | null;
}

interface StudentStats {
  id: string; name: string; grade: string | null;
  examCount: number; examAvg: number;
  quizCount: number; quizAvg: number;
  latestScore: number;
  previousScore: number | null;
  trend: "up" | "down" | "flat" | "none";
  exams: Exam[];
}

interface Student {
  id: string;
  name: string;
  grade: string | null;
}

interface WeakPointTag {
  id: string;
  name: string;
  category: string | null;
}

export default function ExamsPage() {
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [pendingExams, setPendingExams] = useState<Exam[]>([]);
  const [weakPointTags, setWeakPointTags] = useState<WeakPointTag[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ exam: Exam; action: "approve" | "reject" } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/students").then(r => r.json()),
      fetch("/api/exams?groupBy=student").then(r => r.json()),
      fetch("/api/exams?reviewStatus=pending_review").then(r => r.json()),
      fetch("/api/weak-point-tags").then(r => r.json()).catch(() => []),
    ])
      .then(([students, exams, pending, tags]: [Student[], Exam[], Exam[], WeakPointTag[]]) => {
        setPendingExams(pending);
        setWeakPointTags(tags);
        const grouped: Record<string, Exam[]> = {};
        exams.forEach(e => {
          if (!grouped[e.studentId]) grouped[e.studentId] = [];
          grouped[e.studentId].push(e);
        });
        const stats: StudentStats[] = students.map((student) => {
          const sExams = grouped[student.id] || [];
          const sorted = [...sExams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const formal = sExams.filter(e => e.type !== "quiz");
          const quizzes = sExams.filter(e => e.type === "quiz");
          const calcAvg = (list: Exam[]) => list.length > 0 ? Math.round(list.reduce((s, e) => s + (e.score / e.totalScore) * 100, 0) / list.length) : -1;
          const scores = sorted.map(e => (e.score / e.totalScore) * 100);
          const latest = scores[scores.length - 1];
          const previous = scores.length >= 2 ? scores[scores.length - 2] : null;
          let trend: "up" | "down" | "flat" | "none" = "none";
          if (scores.length === 0) trend = "none";
          else if (previous !== null) {
            if (latest > previous) trend = "up";
            else if (latest < previous) trend = "down";
            else trend = "flat";
          }
          return {
            id: student.id, name: student.name, grade: student.grade,
            examCount: formal.length, examAvg: calcAvg(formal),
            quizCount: quizzes.length, quizAvg: calcAvg(quizzes),
            latestScore: scores.length > 0 ? Math.round(latest) : 0,
            previousScore: previous !== null ? Math.round(previous) : null,
            trend, exams: sorted,
          };
        }).sort((a, b) => b.exams.length - a.exams.length || a.name.localeCompare(b.name, "zh-CN"));
        setStudentStats(stats);
        setLoading(false);
      });
  }, []);

  function openReviewDialog(exam: Exam, action: "approve" | "reject") {
    setReviewTarget({ exam, action });
  }

  async function reviewExam(examId: string, action: "approve" | "reject", weakPointDescriptions: string[], rejectionReason: string) {
    const res = await fetch("/api/exams/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, action, weakPointDescriptions, rejectionReason }),
    });
    if (res.ok) {
      setPendingExams((current) => current.filter((exam) => exam.id !== examId));
      setReviewTarget(null);
    }
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
    return created as WeakPointTag;
  }

  if (loading) return <div className="p-6"><PageHeader title="成绩管理" description="加载中..." /></div>;

  return (
    <div>
      <PageHeader title="成绩管理" description="查看每位学生的成绩曲线和分析" />
      <div className="glass-card rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">待审核成绩</h2>
          <span className="text-xs text-gray-400">{pendingExams.length} 条</span>
        </div>
        {pendingExams.length === 0 ? (
          <p className="text-sm text-gray-400">暂无待审核成绩</p>
        ) : (
          <div className="space-y-2">
            {pendingExams.map((exam) => (
              <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{exam.student.name} · {exam.name} · {exam.score}/{exam.totalScore}</p>
                  <p className="text-xs text-gray-400">{new Date(exam.date).toLocaleDateString("zh-CN")} · {exam.learningLink?.subject || "数学"} · {exam.learningLink?.parent?.name || "家长提交"} · {exam.reviewStatus}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openReviewDialog(exam, "approve")} className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-white" type="button">通过</button>
                  <button onClick={() => openReviewDialog(exam, "reject")} className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600" type="button">驳回</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studentStats.map((s) => {
          const trendLabel = s.trend === "up" ? "上升" : s.trend === "down" ? "下降" : s.trend === "flat" ? "持平" : "暂无";
          const trendColor = s.trend === "up" ? "text-green-500" : s.trend === "down" ? "text-red-500" : "text-gray-400";
          return (
            <Link key={s.id} href={`/exams/students/${s.id}`}>
              <div className="glass-card rounded-xl p-5 hover:shadow-lg transition-all duration-200 cursor-pointer hover:translate-y-[-2px]">
                <div className="flex items-center justify-between mb-3">
                  <div><h3 className="text-base font-bold text-gray-900">{s.name}</h3><span className="text-xs text-gray-400">{s.grade || ""}</span></div>
                  <span className={`text-xs font-medium ${trendColor}`}>{trendLabel}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-blue-50/50 rounded-lg p-3">
                    <p className="text-[10px] text-blue-500 font-semibold">正式考试</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.examCount} 次</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{s.examAvg >= 0 ? `${s.examAvg}%` : "-"}</p>
                  </div>
                  <div className="bg-orange-50/50 rounded-lg p-3">
                    <p className="text-[10px] text-orange-500 font-semibold">随堂小测</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.quizCount} 次</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{s.quizAvg >= 0 ? `${s.quizAvg}%` : "-"}</p>
                  </div>
                </div>
                {/* Mini sparkline */}
                <div className="mt-1 flex items-end gap-0.5 h-8">
                  {s.exams.slice(-6).map((e, i) => {
                    const pct = Math.round((e.score / e.totalScore) * 100);
                    const h = Math.max(4, pct / 100 * 32);
                    const isQuiz = e.type === "quiz";
                    return <div key={i} className={`flex-1 rounded-t ${isQuiz ? "bg-orange-400/60" : "bg-blue-400/60"}`} style={{ height: `${h}px` }} title={`${e.name}: ${pct}%`} />;
                  })}
                </div>
                <div className="flex gap-3 text-[10px] text-gray-400 mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-400/60" />正式</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400/60" />小测</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <ReviewExamDialog
        target={reviewTarget}
        weakPointTags={weakPointTags}
        onClose={() => setReviewTarget(null)}
        onCreateTag={createWeakPointTag}
        onSubmit={reviewExam}
      />
    </div>
  );
}

function ReviewExamDialog({
  target,
  weakPointTags,
  onClose,
  onCreateTag,
  onSubmit,
}: {
  target: { exam: Exam; action: "approve" | "reject" } | null;
  weakPointTags: WeakPointTag[];
  onClose: () => void;
  onCreateTag: (name: string) => Promise<WeakPointTag | null>;
  onSubmit: (examId: string, action: "approve" | "reject", weakPointDescriptions: string[], rejectionReason: string) => Promise<void>;
}) {
  const [searchTag, setSearchTag] = useState("");
  const [selectedWeakPoints, setSelectedWeakPoints] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState("成绩信息需要更正");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setSearchTag("");
    setSelectedWeakPoints([]);
    setRejectionReason("成绩信息需要更正");
    setSaving(false);
  }, [target?.exam.id, target?.action]);

  const filteredTags = weakPointTags.filter((tag) =>
    !searchTag.trim() || tag.name.toLowerCase().includes(searchTag.trim().toLowerCase())
  );

  function toggleTag(name: string) {
    setSelectedWeakPoints((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  }

  async function addSearchTag() {
    const tag = await onCreateTag(searchTag);
    if (!tag) return;
    setSelectedWeakPoints((current) => current.includes(tag.name) ? current : [...current, tag.name]);
    setSearchTag("");
  }

  async function submit() {
    if (!target) return;
    setSaving(true);
    await onSubmit(
      target.exam.id,
      target.action,
      target.action === "approve" ? selectedWeakPoints : [],
      target.action === "reject" ? rejectionReason.trim() || "成绩信息需要更正" : ""
    );
    setSaving(false);
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target?.action === "approve" ? "通过成绩审核" : "驳回成绩"}</DialogTitle>
          <DialogDescription>
            {target ? `${target.exam.student.name} · ${target.exam.name} · ${target.exam.score}/${target.exam.totalScore}` : ""}
          </DialogDescription>
        </DialogHeader>

        {target?.action === "approve" ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-500">薄弱点</p>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Button type="button" variant="outline" className="h-12 text-base font-semibold text-gray-600" onClick={addSearchTag}>
                新增标签
              </Button>
              <Input
                className="h-12 text-base"
                placeholder="搜索标签"
                value={searchTag}
                onChange={(event) => setSearchTag(event.target.value)}
              />
            </div>

            <div className="flex min-h-10 flex-wrap gap-2">
              {selectedWeakPoints.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTag(name)}
                  className="rounded-full border bg-white px-3 py-1.5 text-sm font-medium text-gray-500 shadow-sm"
                >
                  {name} <span className="ml-1 text-gray-300">×</span>
                </button>
              ))}
            </div>

            <div className="max-h-40 overflow-auto rounded-lg border bg-gray-50 p-2">
              {filteredTags.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-gray-400">暂无匹配标签</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredTags.map((tag) => {
                    const active = selectedWeakPoints.includes(tag.name);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "bg-white text-gray-500 hover:border-gray-300"}`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-500">驳回原因</label>
            <Input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "保存中..." : target?.action === "approve" ? "通过" : "驳回"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
