import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { getHomeworkStatusLabel } from "@/lib/homework-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeworkDeleteButton } from "@/components/homework-delete-button";

export default async function HomeworkDetailPage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const assignment = await prisma.homeworkAssignment.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: {
      course: true,
      questions: { orderBy: { orderIndex: "asc" } },
      submissions: {
        include: { student: true, currentVersion: true, versions: { orderBy: { versionNumber: "desc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!assignment) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{assignment.title}</h1>
          <p className="text-sm text-slate-500">{assignment.course.name} · {assignment.status === "published" ? "已发布" : "草稿"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/homework"><Button variant="outline">返回</Button></Link>
          <Link href={`/homework/${assignment.id}/review-structure`}><Button variant="outline">核对题目</Button></Link>
          <HomeworkDeleteButton assignmentId={assignment.id} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>学生提交</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignment.status !== "published" && <p className="text-sm text-amber-600">作业尚未发布，发布后会生成学生提交记录。</p>}
            {assignment.submissions.map((submission) => (
              <div key={submission.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{submission.student.name}</p>
                  <p className="text-xs text-slate-500">
                    {getHomeworkStatusLabel(submission.status, assignment.dueAt)}
                    {submission.currentVersion ? ` · 第 ${submission.currentVersion.versionNumber} 次提交` : ""}
                  </p>
                </div>
                <Link href={`/homework/${assignment.id}/submissions/${submission.id}`}>
                  <Button size="sm" variant={submission.currentVersion ? "default" : "outline"}>{submission.currentVersion ? "批改" : "查看"}</Button>
                </Link>
              </div>
            ))}
            {assignment.submissions.length === 0 && <p className="text-sm text-slate-400">暂无学生提交记录。</p>}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>作业文件</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a className="block text-sky-600" href={`/api/homework/files/question/${assignment.id}`} target="_blank">查看题目文件</a>
              <a className="block text-sky-600" href={`/api/homework/files/answer/${assignment.id}`} target="_blank">查看答案/解析</a>
              <p className="text-slate-500">截止：{assignment.dueAt ? assignment.dueAt.toLocaleString("zh-CN") : "未设置"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>题目结构</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assignment.questions.map((question) => (
                <div key={question.id} className="rounded border border-slate-100 p-2">
                  <p className="font-medium">第 {question.number} 题 · {question.type} · {question.score} 分</p>
                  {question.standardAnswer && <p className="text-slate-500">答案：{question.standardAnswer}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
