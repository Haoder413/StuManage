import Link from "next/link";
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

type ReviewFilter = "all" | "pending" | "active" | "mastered" | "done";

export default async function ParentProgressPage({ searchParams }: { searchParams?: { review?: string } }) {
  const user = await requireParent();
  const parentStudents = await getParentStudents(user);
  const activeReviewFilter = getReviewFilter(searchParams?.review);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">学习进度</h1>
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
          const masteredWeakPoints = student.weakPoints.filter((point) => point.status !== "active");
          const consolidatingWeakPoints = masteredWeakPoints.filter((point) => point.reviewSchedules.some((schedule) => schedule.status === "pending"));
          const completedWeakPoints = masteredWeakPoints.filter((point) => !point.reviewSchedules.some((schedule) => schedule.status === "pending"));
          const reviewFilters = [
            { key: "all" as const, label: "全部", count: student.weakPoints.length },
            { key: "pending" as const, label: "待复习", count: pendingWeakPoints.length },
            { key: "active" as const, label: "当前薄弱", count: activeWeakPoints.length },
            { key: "mastered" as const, label: "巩固中", count: consolidatingWeakPoints.length },
            { key: "done" as const, label: "已完成", count: completedWeakPoints.length },
          ];
          const filteredWeakPoints = filterWeakPoints(student.weakPoints, activeReviewFilter);

          return (
            <section key={student.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{student.name} · 学习进度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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
                          <div key={item.id} className="flex flex-col gap-2 border-b border-gray-50 px-3 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-medium text-gray-700">{item.knowledgePoint.name}</span>
                            <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
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
                  <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-gray-100/50 p-1">
                    {reviewFilters.map((filter) => (
                      <Link
                        key={filter.key}
                        href={`/parent/progress?review=${filter.key}`}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                          activeReviewFilter === filter.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {filter.label}
                        {filter.count > 0 && <span className="ml-1 text-gray-400">{filter.count}</span>}
                      </Link>
                    ))}
                  </div>

                  {filteredWeakPoints.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">暂无薄弱点记录</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredWeakPoints.map((point) => {
                        const pendingReview = point.reviewSchedules.find((schedule) => schedule.status === "pending");
                        const completedCount = point.reviewSchedules.filter((schedule) => schedule.status === "completed").length;
                        const lastReviewed = point.reviewSchedules
                          .filter((schedule) => schedule.lastReviewedAt)
                          .sort((a, b) => (b.lastReviewedAt?.getTime() || 0) - (a.lastReviewedAt?.getTime() || 0))[0];
                        const isMastered = point.status !== "active";
                        const isDone = isMastered && !pendingReview;
                        const overdue = pendingReview ? isOverdue(pendingReview.nextReviewAt) : false;
                        const statusLabel = point.status === "active" ? "当前薄弱" : pendingReview ? "巩固中" : "已完成";

                        return (
                          <div key={point.id} className="rounded-xl border border-gray-100 p-4 transition-colors hover:border-gray-200">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900">{point.description}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    point.status === "active"
                                      ? "bg-orange-100 text-orange-600"
                                      : isDone
                                        ? "bg-green-100 text-green-700"
                                        : "bg-blue-100 text-blue-600"
                                  }`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">
                                  创建于 {point.createdAt.toLocaleDateString("zh-CN")}
                                  {point.masteredAt && <span> · 掌握于 {point.masteredAt.toLocaleDateString("zh-CN")}</span>}
                                  <span> · 已复习 {completedCount} 次</span>
                                  <span> · 最近复习 {lastReviewed?.lastReviewedAt ? lastReviewed.lastReviewedAt.toLocaleDateString("zh-CN") : "-"}</span>
                                </p>
                                <p className={`mt-1 text-xs ${overdue ? "text-red-500" : pendingReview ? "text-blue-500" : "text-gray-400"}`}>
                                  {pendingReview
                                    ? `${getStageLabel(pendingReview.stage)} · ${overdue ? "已逾期" : pendingReview.nextReviewAt.toLocaleDateString("zh-CN")}`
                                    : "暂无待复习"}
                                </p>
                              </div>
                            </div>
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

function getReviewFilter(value?: string): ReviewFilter {
  if (value === "pending" || value === "active" || value === "mastered" || value === "done") return value;
  return "all";
}

function filterWeakPoints<T extends { status: string; reviewSchedules: { status: string }[] }>(weakPoints: T[], filter: ReviewFilter) {
  if (filter === "pending") return weakPoints.filter((point) => point.reviewSchedules.some((schedule) => schedule.status === "pending"));
  if (filter === "active") return weakPoints.filter((point) => point.status === "active");
  if (filter === "mastered") return weakPoints.filter((point) => point.status !== "active" && point.reviewSchedules.some((schedule) => schedule.status === "pending"));
  if (filter === "done") return weakPoints.filter((point) => point.status !== "active" && !point.reviewSchedules.some((schedule) => schedule.status === "pending"));
  return weakPoints;
}

function StatCard({ title, value, tone }: { title: string; value: string; tone?: "green" | "blue" }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "green" ? "text-green-600" : tone === "blue" ? "text-blue-500" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
