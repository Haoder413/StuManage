import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requireTeacherLike } from "@/lib/auth";

export default async function ProgressPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    include: {
      kpProgress: true,
      weakPoints: { where: { status: "active" } },
    },
  });
  const totalKps = await prisma.knowledgePoint.count({ where: { workspaceId: user.workspaceId } });

  return (
    <div>
      <PageHeader title="学习进度" description="查看和编辑所有学生的学习进度" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((s) => {
          const mastered = s.kpProgress.filter((p) => p.status === "mastered").length;
          const learning = s.kpProgress.filter((p) => p.status === "learning").length;
          const progressPct = totalKps > 0 ? Math.round((mastered / totalKps) * 100) : 0;
          const activeWeak = s.weakPoints.length;

          return (
            <Link key={s.id} href={`/progress/students/${s.id}`}>
              <div className="glass-card rounded-xl p-5 hover:shadow-lg transition-all duration-200 cursor-pointer hover:translate-y-[-2px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                  <span className="text-xs text-gray-400">{s.grade || ""}</span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>知识点掌握</span>
                    <span>{mastered}/{totalKps} ({progressPct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-gray-500">
                  <span>📖 学习中 <strong className="text-blue-500">{learning}</strong></span>
                  <span>⚠️ 薄弱点 <strong className="text-orange-500">{activeWeak}</strong></span>
                </div>
              </div>
            </Link>
          );
        })}
        {students.length === 0 && (
          <p className="text-sm text-gray-400 col-span-3 text-center py-12">暂无学生数据</p>
        )}
      </div>
    </div>
  );
}
