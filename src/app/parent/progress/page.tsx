import { requireParent } from "@/lib/auth";
import { getParentStudents } from "@/lib/parent-data";
import { getStageLabel, isOverdue } from "@/lib/review-scheduler";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabels: Record<string, string> = {
  mastered: "已掌握",
  learning: "学习中",
  not_started: "未开始",
};

const statusStyles: Record<string, string> = {
  mastered: "bg-green-100 text-green-700 border-green-200",
  learning: "bg-blue-100 text-blue-700 border-blue-200",
  not_started: "bg-gray-100 text-gray-500 border-gray-200",
};

export default async function ParentProgressPage() {
  const user = await requireParent();
  const parentStudents = await getParentStudents(user);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">学习进度</h1>
        <p className="mt-1 text-sm text-slate-500">查看知识点进度和薄弱点复习情况</p>
      </div>

      <div className="grid gap-6">
        {parentStudents.map(({ student }) => {
          const totalKps = student.kpProgress.length;
          const masteredCount = student.kpProgress.filter((item) => item.status === "mastered").length;
          const learningCount = student.kpProgress.filter((item) => item.status === "learning").length;
          const progressPct = totalKps > 0 ? Math.round((masteredCount / totalKps) * 100) : 0;
          const pendingWeakPoints = student.weakPoints.filter((point) => point.reviewSchedules.some((schedule) => schedule.status === "pending"));
          const activeWeakPoints = student.weakPoints.filter((point) => point.status === "active");

          return (
            <section key={student.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{student.name} · 学习进度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard title="知识点总数" value={String(totalKps)} />
                    <StatCard title="已掌握" value={String(masteredCount)} tone="green" />
                    <StatCard title="学习中" value={String(learningCount)} tone="blue" />
                    <StatCard title="整体进度" value={`${progressPct}%`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>知识点进度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{masteredCount}/{totalKps}</span>
                  </div>

                  {student.kpProgress.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">暂无知识点数据</p>
                  ) : (
                    <div className="space-y-1">
                      {student.kpProgress.map((item) => {
                        const style = statusStyles[item.status] || statusStyles.not_started;
                        return (
                          <div key={item.id} className="flex items-center justify-between border-b border-gray-50 px-3 py-2 last:border-0">
                            <span className="text-sm font-medium text-gray-700">{item.knowledgePoint.name}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
                              {statusLabels[item.status] || "未开始"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>薄弱点复习</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-600">当前薄弱 {activeWeakPoints.length}</span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-600">待复习 {pendingWeakPoints.length}</span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">全部 {student.weakPoints.length}</span>
                  </div>

                  {student.weakPoints.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">暂无薄弱点记录</p>
                  ) : (
                    <div className="space-y-3">
                      {student.weakPoints.map((point) => {
                        const pendingReview = point.reviewSchedules.find((schedule) => schedule.status === "pending");
                        const completedCount = point.reviewSchedules.filter((schedule) => schedule.status === "completed").length;
                        const overdue = pendingReview ? isOverdue(pendingReview.nextReviewAt) : false;
                        const statusLabel = point.status === "active" ? "当前薄弱" : pendingReview ? "巩固中" : "已完成";

                        return (
                          <div key={point.id} className="rounded-xl border border-gray-100 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{point.description}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                point.status === "active"
                                  ? "bg-orange-100 text-orange-600"
                                  : pendingReview
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-green-100 text-green-700"
                              }`}>
                                {statusLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              创建于 {point.createdAt.toLocaleDateString("zh-CN")}
                              {point.masteredAt && <span> · 掌握于 {point.masteredAt.toLocaleDateString("zh-CN")}</span>}
                              <span> · 已复习 {completedCount} 次</span>
                            </p>
                            <p className={`mt-1 text-xs ${overdue ? "text-red-500" : pendingReview ? "text-blue-500" : "text-gray-400"}`}>
                              {pendingReview
                                ? `${getStageLabel(pendingReview.stage)} · ${overdue ? "已逾期" : pendingReview.nextReviewAt.toLocaleDateString("zh-CN")}`
                                : "暂无待复习"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ title, value, tone }: { title: string; value: string; tone?: "green" | "blue" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "green" ? "text-green-600" : tone === "blue" ? "text-blue-500" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
