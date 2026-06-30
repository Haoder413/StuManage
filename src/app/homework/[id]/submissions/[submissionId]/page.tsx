"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Question = { id: string; number: string; type: string; score: number; standardAnswer?: string | null; explanation?: string | null };
type ExistingReview = { questionId: string; score: number; comment?: string | null; isCorrect: boolean };
type Submission = {
  id: string;
  status: string;
  student: { name: string };
  currentVersion?: { id: string; versionNumber: number; totalScore?: number | null; overallComment?: string | null; reviews?: ExistingReview[] } | null;
};
type Assignment = {
  id: string;
  title: string;
  questions: Question[];
  submissions: Submission[];
};
type ReviewDraft = { questionId: string; score: number; comment: string; isCorrect: boolean };

function PreviewFrame({
  title,
  url,
  emptyText,
  note,
  actionLabel,
  actionUrl,
}: {
  title: string;
  url: string;
  emptyText: string;
  note?: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden xl:min-h-0">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {actionUrl && <a className="text-sm font-semibold text-sky-600" href={actionUrl} target="_blank">{actionLabel || "新窗口打开"}</a>}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden text-sm">
        {url ? (
          <div className="flex h-full flex-col gap-2">
            {note && <p className="shrink-0 text-slate-500">{note}</p>}
            <iframe
              title={title}
              src={url}
              className="min-h-0 flex-1 rounded-lg border border-slate-100 bg-white"
            />
          </div>
        ) : (
          <p className="text-slate-400">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomeworkGradePage() {
  const params = useParams<{ id: string; submissionId: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [reviews, setReviews] = useState<ReviewDraft[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/homework/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setAssignment(data);
        const targetSubmission = (data.submissions || []).find((item: Submission) => item.id === params.submissionId);
        const existingReviews = new Map<string, ExistingReview>(
          (targetSubmission?.currentVersion?.reviews || []).map((review: ExistingReview) => [review.questionId, review])
        );
        setReviews((data.questions || []).map((question: Question) => {
          const existing = existingReviews.get(question.id);
          return {
            questionId: question.id,
            score: existing?.score || 0,
            comment: existing?.comment || "",
            isCorrect: existing?.isCorrect || false,
          };
        }));
        setOverallComment(targetSubmission?.currentVersion?.overallComment || "");
      });
  }, [params.id]);

  const submission = useMemo(
    () => assignment?.submissions.find((item) => item.id === params.submissionId) || null,
    [assignment, params.submissionId]
  );

  function updateReview(index: number, field: keyof ReviewDraft, value: string | boolean) {
    setReviews((prev) => prev.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      [field]: field === "score" ? Number(value) : value,
    } : item));
  }

  async function submitGrade() {
    setMessage("");
    const res = await fetch(`/api/homework/${params.id}/submissions/${params.submissionId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews, overallComment }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || "批改失败");
      return;
    }
    setMessage("批改已保存");
    router.refresh();
  }

  if (!assignment || !submission) return <p className="text-sm text-slate-400">加载中...</p>;

  const studentPreviewUrl = submission.currentVersion ? `/api/homework/files/submission/${submission.currentVersion.id}` : "";
  const answerPreviewUrl = `/api/homework/files/answer/${assignment.id}`;
  const answerDownloadUrl = `/api/homework/files/answer/${assignment.id}?mode=download`;

  return (
    <div className="flex h-[calc(100vh-48px)] min-h-[760px] flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">批改作业</h1>
          <p className="text-sm text-slate-500">{assignment.title} · {submission.student.name}</p>
        </div>
        <Link href={`/homework/${assignment.id}`}><Button variant="outline">返回作业</Button></Link>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[38%_32%_30%]">
        <PreviewFrame
          title="学生答案预览"
          url={studentPreviewUrl}
          emptyText="家长尚未提交答案。"
          note={submission.currentVersion ? `当前版本：第 ${submission.currentVersion.versionNumber} 次提交。三栏独立滚动。` : undefined}
          actionLabel="下载学生答案"
          actionUrl={submission.currentVersion ? `${studentPreviewUrl}?mode=download` : ""}
        />
        <PreviewFrame
          title="标准答案预览"
          url={answerPreviewUrl}
          emptyText="暂无标准答案文件。"
          note="这里显示老师上传的答案/解析文件，便于和学生答案对照。"
          actionLabel="下载答案"
          actionUrl={answerDownloadUrl}
        />
        <Card className="flex min-h-[520px] min-w-0 flex-col overflow-hidden xl:min-h-0">
          <CardHeader className="shrink-0"><CardTitle>逐题批改</CardTitle></CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-3">
            {assignment.questions.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">第 {question.number} 题</span>
                  <span className="text-slate-400">{question.type} · 满分 {question.score}</span>
                  {question.standardAnswer && <span className="text-slate-500">答案：{question.standardAnswer}</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-[120px_1fr_100px]">
                  <label className="text-xs text-slate-500">得分<Input type="number" value={reviews[index]?.score || 0} onChange={(e) => updateReview(index, "score", e.target.value)} /></label>
                  <label className="text-xs text-slate-500">评语<Input value={reviews[index]?.comment || ""} onChange={(e) => updateReview(index, "comment", e.target.value)} /></label>
                  <label className="mt-6 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={reviews[index]?.isCorrect || false} onChange={(e) => updateReview(index, "isCorrect", e.target.checked)} />
                    正确
                  </label>
                </div>
              </div>
            ))}
            <label className="block text-sm font-medium text-slate-600">总评<Input value={overallComment} onChange={(e) => setOverallComment(e.target.value)} className="mt-1" /></label>
            {message && <p className="text-sm text-sky-600">{message}</p>}
          </CardContent>
          <div className="shrink-0 border-t border-slate-100 bg-white/90 p-4">
            <Button className="w-full" disabled={!submission.currentVersion} onClick={submitGrade}>保存批改</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
