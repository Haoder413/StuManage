"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";

interface Exam {
  id: string;
  studentId: string;
  name: string;
  type: string;
  score: number;
  totalScore: number;
  date: string;
  student: { id: string; name: string; grade: string | null };
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

export default function ExamsPage() {
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/students").then(r => r.json()),
      fetch("/api/exams?groupBy=student").then(r => r.json()),
    ])
      .then(([students, exams]: [Student[], Exam[]]) => {
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

  if (loading) return <div className="p-6"><PageHeader title="成绩管理" description="加载中..." /></div>;

  return (
    <div>
      <PageHeader title="成绩管理" description="查看每位学生的成绩曲线和分析" />
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
    </div>
  );
}
