"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Review = { id: string; score: number; comment?: string | null; isCorrect: boolean; question: { number: string; type: string; score: number } };
type Version = { id: string; versionNumber: number; status: string; totalScore?: number | null; overallComment?: string | null; submittedAt: string; reviews?: Review[] };
type Submission = {
  id: string;
  status: string;
  totalScore?: number | null;
  overallComment?: string | null;
  student: { name: string };
  assignment: {
    id: string;
    title: string;
    description?: string | null;
    dueAt?: string | null;
    course: { name: string };
    questions: { id: string; number: string; type: string; score: number }[];
  };
  currentVersion?: Version | null;
  versions: Version[];
};

function statusLabel(status: string, dueAt?: string | null) {
  if (status === "graded") return "已批改";
  if (status === "submitted") return "已提交";
  if (status === "pending" && dueAt && new Date(dueAt).getTime() < Date.now()) return "已逾期";
  return "待提交";
}

export default function ParentHomeworkDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/parent/homework")
      .then((res) => res.json())
      .then((data) => setSubmissions(Array.isArray(data) ? data : []));
  }, []);

  const submission = useMemo(
    () => submissions.find((item) => item.id === params.submissionId) || null,
    [submissions, params.submissionId]
  );

  async function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const res = await fetch(`/api/parent/homework/${params.submissionId}/submit`, { method: "POST", body: formData });
    setMessage(res.ok ? "答案已上传，等待老师批改" : "上传失败，请检查文件格式");
    if (res.ok) {
      router.refresh();
      const data = await fetch("/api/parent/homework").then((item) => item.json());
      setSubmissions(Array.isArray(data) ? data : []);
    }
  }

  if (!submission) return <p className="text-sm text-slate-400">加载中...</p>;

  const currentReviews = submission.currentVersion?.reviews || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{submission.assignment.title}</h1>
          <p className="text-sm text-slate-500">{submission.student.name} · {submission.assignment.course.name}</p>
        </div>
        <Link href="/parent/homework"><Button variant="outline">返回</Button></Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>提交答案</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              <p>状态：{statusLabel(submission.status, submission.assignment.dueAt)}</p>
              <p>截止：{submission.assignment.dueAt ? new Date(submission.assignment.dueAt).toLocaleString("zh-CN") : "未设置"}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <a className="text-sky-600" href={`/api/homework/files/question/${submission.assignment.id}`} target="_blank">查看题目文件</a>
                <a className="text-sky-600" href={`/api/homework/files/answer/${submission.assignment.id}?mode=download`}>下载答案/解析</a>
              </div>
            </div>
            <form onSubmit={submitFile} className="space-y-3">
              <Input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required />
              <Button>上传答案</Button>
              {message && <p className="text-sm text-sky-600">{message}</p>}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>当前批改</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {submission.status !== "graded" ? (
              <p className="text-slate-400">老师尚未完成当前版本批改。</p>
            ) : (
              <>
                <p className="text-lg font-bold text-slate-900">总分：{submission.totalScore ?? 0}</p>
                {submission.overallComment && <p className="text-slate-600">总评：{submission.overallComment}</p>}
                <div className="space-y-2">
                  {currentReviews.map((review) => (
                    <div key={review.id} className="rounded border border-slate-100 p-2">
                      <p className="font-medium">第 {review.question.number} 题：{review.score}/{review.question.score}</p>
                      {review.comment && <p className="text-slate-500">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>提交历史</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {submission.versions.map((version) => (
            <div key={version.id} className="rounded border border-slate-100 p-2">
              <div className="flex items-center justify-between gap-3">
                <span>第 {version.versionNumber} 次 · {new Date(version.submittedAt).toLocaleString("zh-CN")} · {version.status === "graded" ? "已批改" : "待批改"}</span>
                <a className="text-sky-600" href={`/api/homework/files/submission/${version.id}`} target="_blank">查看文件</a>
              </div>
              {version.status === "graded" && (
                <div className="mt-2 text-slate-500">
                  <p>总分：{version.totalScore ?? 0}</p>
                  {version.overallComment && <p>总评：{version.overallComment}</p>}
                </div>
              )}
            </div>
          ))}
          {submission.versions.length === 0 && <p className="text-slate-400">尚未提交。</p>}
        </CardContent>
      </Card>
    </div>
  );
}
