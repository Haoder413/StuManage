import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/auth";
import { getHomeworkStatusLabel } from "@/lib/homework-access";

export default async function ParentHomeworkPage() {
  const user = await requireParent();
  const submissions = await prisma.homeworkSubmission.findMany({
    where: {
      workspaceId: user.workspaceId,
      assignment: { status: "published" },
      student: { parentLinks: { some: { parentId: user.id } } },
    },
    include: {
      student: true,
      assignment: { include: { course: true } },
      currentVersion: true,
      versions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">作业</h1>
        <p className="text-sm text-slate-500">查看课程作业，上传答案并查看老师批改</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {submissions.map((submission) => (
          <Link key={submission.id} href={`/parent/homework/${submission.id}`} className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm transition hover:border-sky-200">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{submission.assignment.title}</h2>
                <p className="text-xs text-slate-400">{submission.student.name} · {submission.assignment.course.name}</p>
              </div>
              <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-600">
                {getHomeworkStatusLabel(submission.status, submission.assignment.dueAt)}
              </span>
            </div>
            <div className="space-y-1 text-sm text-slate-500">
              <p>截止：{submission.assignment.dueAt ? submission.assignment.dueAt.toLocaleString("zh-CN") : "未设置"}</p>
              <p>提交次数：{submission.versions.length}</p>
              {submission.status === "graded" && <p>得分：{submission.totalScore ?? 0}</p>}
            </div>
          </Link>
        ))}
        {submissions.length === 0 && <p className="text-sm text-slate-400">暂无作业。</p>}
      </div>
    </div>
  );
}
