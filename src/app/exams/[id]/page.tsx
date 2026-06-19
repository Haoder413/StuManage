import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeacherLike } from "@/lib/auth";

export default async function ExamDetailPage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const exam = await prisma.exam.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: { student: true },
  });

  if (!exam) notFound();

  const rate = Math.round((exam.score / exam.totalScore) * 100);

  return (
    <div>
      <PageHeader title={exam.name} description={exam.date.toLocaleDateString("zh-CN")} />
      <Card>
        <CardHeader>
          <CardTitle>
            {exam.student.name} · {exam.score} / {exam.totalScore} ({rate}%)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">类型</span><span>{exam.type === "entrance" ? "摸底" : exam.type === "monthly" ? "阶段测试" : "随堂测验"}</span></div>
          {exam.notes && <div className="flex justify-between"><span className="text-slate-500">备注</span><span>{exam.notes}</span></div>}
        </CardContent>
      </Card>
    </div>
  );
}
