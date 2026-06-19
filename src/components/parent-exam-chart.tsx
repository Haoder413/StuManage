"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const examTypeLabel: Record<string, string> = { entrance: "摸底", monthly: "阶段测试", quiz: "随堂小测" };

export type ParentExamChartItem = {
  id: string;
  name: string;
  type: string;
  score: number;
  totalScore: number;
  date: string;
};

export function ParentExamChart({ exams }: { exams: ParentExamChartItem[] }) {
  const sorted = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const scores = sorted.map((exam) => Math.round((exam.score / exam.totalScore) * 100));
  const average = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const chartData = sorted.map((exam) => ({
    name: exam.name,
    type: examTypeLabel[exam.type] || exam.type,
    formalScore: exam.type !== "quiz" ? Math.round((exam.score / exam.totalScore) * 100) : null,
    quizScore: exam.type === "quiz" ? Math.round((exam.score / exam.totalScore) * 100) : null,
  }));

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="mb-4 font-semibold text-gray-900">成绩趋势图</h3>
      {sorted.length < 2 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">至少需要两次成绩才能显示曲线图</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#999" }} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#999" }} label={{ value: "得分率 %", angle: -90, position: "left", offset: 10, style: { fontSize: 12, fill: "#999" } }} />
              <Tooltip formatter={(value: number) => value != null ? `${value}%` : "-"} labelFormatter={(label) => `考试: ${label}`} />
              <Legend />
              <ReferenceLine y={average} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: `均分 ${average}%`, position: "right", style: { fontSize: 11, fill: "#94a3b8" } }} />
              <Line connectNulls type="linear" dataKey="formalScore" name="正式考试" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
              <Line connectNulls type="linear" dataKey="quizScore" name="随堂小测" stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={2.5} dot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
