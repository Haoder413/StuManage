import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { getParentLearningData } from "@/lib/parent-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParentKnowledgeProgressTree } from "./parent-knowledge-progress-tree";
import { ParentProgressSection } from "./parent-progress-section";
import { filterWeakPointsByStatus, getWeakPointStatusCounts, type WeakPointStatusFilter } from "@/lib/weak-points";

type ReviewFilter = WeakPointStatusFilter;

export default async function ParentProgressPage({ searchParams }: { searchParams?: { link?: string; review?: string } }) {
  const user = await requireParent();
  const { learningLinks, selectedLink, selectedLinkId, parentStudents } = await getParentLearningData(user, searchParams?.link);
  const activeReviewFilter = getReviewFilter(searchParams?.review);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">学习进度</h1>
        <p className="mt-1 text-sm text-slate-500">
          {selectedLink
            ? `查看 ${selectedLink.student?.name || "学生"} · ${selectedLink.subject} · ${selectedLink.teacher?.name || "老师"} 的知识点进度和薄弱点复习情况`
            : "查看知识点进度和薄弱点复习情况"}
        </p>
      </div>

      {learningLinks.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {learningLinks.map((link) => {
            const active = link.id === selectedLinkId;
            return (
              <Link
                key={link.id}
                href={`/parent/progress?link=${link.id}&review=${activeReviewFilter}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {link.student?.name || "学生"} · {link.subject} · {link.teacher?.name || "老师"}
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid gap-6">
        {parentStudents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-400">
              暂无可查看的学习关系，请联系老师或管理员配置。
            </CardContent>
          </Card>
        ) : parentStudents.map(({ student }) => {
          const totalKps = student.kpProgress.length;
          const masteredCount = student.kpProgress.filter((item) => item.status === "mastered").length;
          const learningCount = student.kpProgress.filter((item) => item.status === "learning").length;
          const progressPct = totalKps > 0 ? Math.round((masteredCount / totalKps) * 100) : 0;
          const weakPointCounts = getWeakPointStatusCounts(student.weakPoints);
          const reviewFilters = [
            { key: "all" as const, label: "全部", count: weakPointCounts.all },
            { key: "pending" as const, label: "待复习", count: weakPointCounts.pending },
            { key: "mastered" as const, label: "已掌握", count: weakPointCounts.mastered },
          ];
          const filteredWeakPoints = filterWeakPointsByStatus(student.weakPoints, activeReviewFilter);

          return (
            <section key={student.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{student.name} · 学习进度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
                    <StatCard title="剩余课时" value={String(student.remainingLessonHours)} tone="orange" />
                    <StatCard title="知识点总数" value={String(totalKps)} />
                    <StatCard title="已学习" value={String(masteredCount)} tone="green" />
                    <StatCard title="学习中" value={String(learningCount)} tone="blue" />
                    <StatCard title="整体进度" value={`${progressPct}%`} />
                  </div>
                </CardContent>
              </Card>

              <ParentProgressSection title="薄弱点复习" count={student.weakPoints.length} defaultOpen={false}>
                <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-gray-100/50 p-1">
                  {reviewFilters.map((filter) => (
                    <Link
                      key={filter.key}
                      href={`/parent/progress?link=${selectedLinkId}&review=${filter.key}`}
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
                      const completedCount = point.reviewSchedules.filter((schedule) => schedule.status === "completed").length;
                      const lastReviewed = point.reviewSchedules
                        .filter((schedule) => schedule.lastReviewedAt)
                        .sort((a, b) => (b.lastReviewedAt?.getTime() || 0) - (a.lastReviewedAt?.getTime() || 0))[0];
                      const isMastered = point.status !== "active";
                      const statusLabel = isMastered ? "已掌握" : "待复习";

                      return (
                        <div key={point.id} className="rounded-xl border border-gray-100 p-4 transition-colors hover:border-gray-200">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">{point.description}</p>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  point.status === "active"
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-green-100 text-green-700"
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
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ParentProgressSection>

              <ParentProgressSection
                title="知识点进度"
                count={totalKps}
                defaultOpen={false}
                summary={(
                  <span className="flex w-full items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: `${progressPct}%` }} />
                    </span>
                    <span className="text-xs text-gray-500">{masteredCount}/{totalKps}</span>
                  </span>
                )}
              >

                  {student.kpProgress.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">暂无知识点数据</p>
                  ) : (
                    <ParentKnowledgeProgressTree
                      items={student.kpProgress.map((item) => ({
                        id: item.id,
                        status: item.status,
                        knowledgePoint: {
                          id: item.knowledgePoint.id,
                          name: item.knowledgePoint.name,
                          parentId: item.knowledgePoint.parentId,
                          orderIndex: item.knowledgePoint.orderIndex,
                          courseId: item.knowledgePoint.courseId,
                        },
                      }))}
                    />
                  )}
              </ParentProgressSection>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function getReviewFilter(value?: string): ReviewFilter {
  if (value === "pending" || value === "mastered") return value;
  return "all";
}

function StatCard({ title, value, tone }: { title: string; value: string; tone?: "green" | "blue" | "orange" }) {
  const valueClass = tone === "green"
    ? "text-green-600"
    : tone === "blue"
      ? "text-blue-500"
      : tone === "orange"
        ? "text-orange-500"
        : "text-gray-900";

  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
