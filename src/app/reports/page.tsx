import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeacherLike } from "@/lib/auth";

export default async function ReportsPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    include: { exams: { orderBy: { date: "desc" } }, kpProgress: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="报表导出" description="成绩单和学习进度报告" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {students.map((s) => {
          const mastered = s.kpProgress.filter((p) => p.status === "mastered").length;
          const totalKp = s.kpProgress.length;
          const avgScore = s.exams.length > 0
            ? Math.round(s.exams.reduce((sum, e) => sum + (e.score / e.totalScore) * 100, 0) / s.exams.length)
            : 0;
          return (
            <Card key={s.id}>
              <CardHeader className="p-4"><CardTitle className="!text-base">{s.name}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#1a1a2e]/40">平均得分率</span><span className="font-medium text-[#1a1a2e]">{avgScore}%</span></div>
                <div className="flex justify-between"><span className="text-[#1a1a2e]/40">考试次数</span><span className="text-[#1a1a2e]/70">{s.exams.length}</span></div>
                <div className="flex justify-between"><span className="text-[#1a1a2e]/40">已掌握知识点</span><span className="text-[#1a1a2e]/70">{totalKp > 0 ? `${Math.round((mastered / totalKp) * 100)}%` : "-"}</span></div>
                <div className="text-xs text-[#1a1a2e]/30 mt-2">最新考试: {s.exams[0] ? `${s.exams[0].name} (${s.exams[0].score}/${s.exams[0].totalScore})` : "无"}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
