import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomeworkPage() {
  const user = await requireTeacherLike();
  const assignments = await prisma.homeworkAssignment.findMany({
    where: { workspaceId: user.workspaceId },
    include: { course: true, submissions: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title="作业批改" description="按课程发布作业，查看提交并逐题批改" />
        <Link href="/homework/new"><Button>新建作业</Button></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assignments.map((assignment) => {
          const submitted = assignment.submissions.filter((item) => item.status !== "pending").length;
          const graded = assignment.submissions.filter((item) => item.status === "graded").length;
          return (
            <Link key={assignment.id} href={`/homework/${assignment.id}`}>
              <Card className="h-full transition hover:border-sky-200 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">{assignment.title}</CardTitle>
                  <p className="text-xs text-slate-400">{assignment.course.name}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-600">
                  <p>状态：{assignment.status === "published" ? "已发布" : "草稿"}</p>
                  <p>截止：{assignment.dueAt ? assignment.dueAt.toLocaleDateString("zh-CN") : "未设置"}</p>
                  <p>提交：{submitted}/{assignment.submissions.length}，已批改：{graded}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {assignments.length === 0 && <p className="text-sm text-slate-400">暂无作业。</p>}
      </div>
    </div>
  );
}
