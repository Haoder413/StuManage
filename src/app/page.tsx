import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/review-scheduler";
import { PageHeader } from "@/components/page-header";
import { requireTeacherLike } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireTeacherLike();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [studentCount, examCount, pendingReviews, todaySchedules] = await Promise.all([
    prisma.student.count({ where: { workspaceId: user.workspaceId } }),
    prisma.exam.count({ where: { workspaceId: user.workspaceId } }),
    prisma.reviewSchedule.findMany({
      where: { workspaceId: user.workspaceId, status: "pending", nextReviewAt: { lte: new Date() } },
      include: { weakPoint: { include: { student: true } } },
      orderBy: { nextReviewAt: "asc" },
      take: 10,
    }),
    prisma.schedule.findMany({
      where: {
        workspaceId: user.workspaceId,
        OR: [
          { type: "fixed", dayOfWeek: today.getDay() },
          { type: "flexible", date: { gte: today, lt: tomorrow } },
        ],
      },
      include: { student: true },
      take: 10,
    }),
  ]);

  return (
    <div>
      <PageHeader title="仪表盘" description={today.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 rounded-lg">
          <p className="text-xs text-[#1a1a2e]/40 uppercase tracking-wider font-semibold">学生总数</p>
          <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{studentCount}</p>
        </div>
        <div className="glass-card p-4 rounded-lg">
          <p className="text-xs text-[#1a1a2e]/40 uppercase tracking-wider font-semibold">考试记录</p>
          <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{examCount}</p>
        </div>
        <div className="glass-card p-4 rounded-lg">
          <p className="text-xs text-[#1a1a2e]/40 uppercase tracking-wider font-semibold">待复习提醒</p>
          <p className="text-2xl font-bold text-[#e07a5f] mt-1">{pendingReviews.length}</p>
        </div>
        <div className="glass-card p-4 rounded-lg">
          <p className="text-xs text-[#1a1a2e]/40 uppercase tracking-wider font-semibold">今日课程</p>
          <p className="text-2xl font-bold text-[#1a1a2e] mt-1">{todaySchedules.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass-panel p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-[#1a1a2e] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e07a5f]"></span>
            待复习提醒
          </h3>
          {pendingReviews.length === 0 ? (
            <p className="text-sm text-[#1a1a2e]/40">暂无待复习提醒</p>
          ) : (
            <div className="space-y-2">
              {pendingReviews.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm border-b border-[#1a1a2e]/5 pb-2 last:border-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    isOverdue(r.nextReviewAt) ? "bg-[#e07a5f]/10 text-[#e07a5f]" : "bg-[#3d5a80]/10 text-[#3d5a80]"
                  }`}>
                    {isOverdue(r.nextReviewAt) ? "逾期" : "待复习"}
                  </span>
                  <span className="text-[#1a1a2e]/70">{r.weakPoint.student.name} — {r.weakPoint.description}</span>
                  <span className="text-xs text-[#1a1a2e]/30 ml-auto">第{r.stage}次</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-[#1a1a2e] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a80]"></span>
            今日课程
          </h3>
          {todaySchedules.length === 0 ? (
            <p className="text-sm text-[#1a1a2e]/40">今日无课程安排</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm border-b border-[#1a1a2e]/5 pb-2 last:border-0">
                  <span className="bg-[#1a1a2e]/5 text-[#1a1a2e]/60 px-1.5 py-0.5 rounded text-xs font-medium">
                    {s.startTime || "待定"}{s.endTime ? `-${s.endTime}` : ""}
                  </span>
                  <span className="text-[#1a1a2e]/70">{s.student.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
