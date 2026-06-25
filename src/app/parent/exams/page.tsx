import { requireParent } from "@/lib/auth";
import { getParentStudents } from "@/lib/parent-data";
import { getParentLearningLinks } from "@/lib/learning-links";
import { ParentExamChart } from "@/components/parent-exam-chart";
import { ParentExamSubmissionForm } from "@/components/parent-exam-submission-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const examTypeLabel: Record<string, string> = { entrance: "摸底", monthly: "阶段测试", quiz: "随堂小测" };

export default async function ParentExamsPage() {
  const user = await requireParent();
  const [parentStudents, learningLinks] = await Promise.all([
    getParentStudents(user),
    getParentLearningLinks(user),
  ]);
  const learningLinkOptions = learningLinks.map((link) => ({
    id: link.id,
    learningLinkId: link.id,
    studentId: link.studentId,
    label: `${link.student?.name || "学生"} · ${link.subject}`,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">成绩记录</h1>
        <p className="mt-1 text-sm text-slate-500">查看考试、测验和平均得分率</p>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>提交成绩</CardTitle></CardHeader>
        <CardContent>
          <ParentExamSubmissionForm learningLinks={learningLinkOptions} />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {parentStudents.map(({ student }) => {
          const officialExams = student.exams.filter((exam) => exam.reviewStatus === "approved");
          const pendingExams = student.exams.filter((exam) => exam.reviewStatus === "pending_review" || exam.reviewStatus === "rejected");
          const exams = [...officialExams].sort((a, b) => a.date.getTime() - b.date.getTime());
          const formal = exams.filter((exam) => exam.type !== "quiz");
          const quizzes = exams.filter((exam) => exam.type === "quiz");
          const scores = exams.map((exam) => Math.round((exam.score / exam.totalScore) * 100));
          const calcAvg = (items: typeof exams) => items.length
            ? Math.round(items.reduce((sum, exam) => sum + (exam.score / exam.totalScore) * 100, 0) / items.length)
            : -1;
          const formalAvg = calcAvg(formal);
          const quizAvg = calcAvg(quizzes);
          const maxScore = scores.length ? Math.max(...scores) : 0;
          const minScore = scores.length ? Math.min(...scores) : 0;
          const improvement = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
          return (
            <section key={student.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{student.name} · 成绩分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
                    <StatCard title="正式考试均分" value={formalAvg >= 0 ? `${formalAvg}%` : "-"} note={`${formal.length} 次`} />
                    <StatCard title="小测平均分" value={quizAvg >= 0 ? `${quizAvg}%` : "-"} note={`${quizzes.length} 次`} />
                    <StatCard title="最高" value={scores.length ? `${maxScore}%` : "-"} tone="green" />
                    <StatCard title="最低" value={scores.length ? `${minScore}%` : "-"} tone="red" />
                    <StatCard title="进步幅度" value={scores.length >= 2 ? `${improvement >= 0 ? "+" : ""}${improvement}%` : "-"} tone={improvement >= 0 ? "green" : "red"} />
                  </div>
                </CardContent>
              </Card>

              <ParentExamChart
                exams={exams.map((exam) => ({
                  id: exam.id,
                  name: exam.name,
                  type: exam.type,
                  score: exam.score,
                  totalScore: exam.totalScore,
                  date: exam.date.toISOString(),
                }))}
              />

              <Card>
                <CardHeader><CardTitle>考试明细</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {exams.length === 0 ? <p className="text-sm text-slate-400">暂无成绩记录</p> : [...exams].reverse().map((exam) => {
                      const pct = Math.round((exam.score / exam.totalScore) * 100);
                      return (
                        <div key={exam.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">{exam.name}</p>
                            <p className="text-xs text-slate-400">{exam.date.toLocaleDateString("zh-CN")} · {examTypeLabel[exam.type] || exam.type}</p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right">
                            <p className="font-bold text-slate-900">{exam.score}/{exam.totalScore}</p>
                            <p className={`text-xs font-semibold ${pct >= 80 ? "text-green-500" : pct >= 60 ? "text-orange-500" : "text-red-500"}`}>{pct}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>家长提交记录</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingExams.length === 0 ? <p className="text-sm text-slate-400">暂无待审核或被驳回成绩</p> : pendingExams.map((exam) => (
                      <div key={exam.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{exam.name}</p>
                          <p className="text-xs text-slate-400">{exam.date.toLocaleDateString("zh-CN")} · {exam.reviewStatus === "pending_review" ? "待审核 pending_review" : `已驳回：${exam.rejectionReason || "未填写原因"}`}</p>
                        </div>
                        <p className="shrink-0 font-bold text-slate-900">{exam.score}/{exam.totalScore}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ title, value, note, tone }: { title: string; value: string; note?: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase text-slate-400">{title}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "green" ? "text-green-500" : tone === "red" ? "text-red-500" : "text-slate-900"}`}>{value}</p>
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}
