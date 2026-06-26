import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentDetailEditor } from "./student-detail-editor";
import { requireTeacherLike } from "@/lib/auth";

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const student = await prisma.student.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: {
      studentCourses: { include: { course: true } },
      exams: true,
      weakPoints: { where: { status: "active" } },
      attendance: {
        orderBy: { date: "desc" },
        include: { schedule: true },
      },
      lessonHourLogs: {
        orderBy: { createdAt: "desc" },
        include: { attendance: { include: { schedule: true } } },
        take: 50,
      },
      communicationLogs: { orderBy: { date: "desc" }, take: 5 },
    },
  });

  if (!student) notFound();
  const weakPointCount = student.weakPoints.length;
  const attendanceCount = student.attendance.length;
  const presentCount = student.attendance.filter((a) => a.status === "present").length;
  const totalLessonHours = student.totalLessonHours || 0;
  const remainingLessonHours = student.remainingLessonHours || 0;
  const activeStudentCourses = Array.from(
    new Map(
      student.studentCourses
        .filter((item) => item.status === "active")
        .map((item) => [item.courseId, item])
    ).values()
  );
  const courseNames = activeStudentCourses.map((item) => item.course.name);
  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;
  const avgScore = student.exams.length > 0
    ? Math.round(student.exams.reduce((sum, e) => sum + (e.score / e.totalScore) * 100, 0) / student.exams.length)
    : 0;
  const lessonReviews = student.attendance.filter((a) => a.status === "present" || a.status === "makeup");

  return (
    <div>
      <div className="mb-4">
        <Link href="/students"><Button variant="outline" size="sm">返回</Button></Link>
      </div>
      <PageHeader
        title={student.name}
        description={`${student.grade || "未设置年级"} · ${student.lessonFrequency || "未设置频次"}`}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardHeader className="p-4"><CardTitle className="!text-sm text-[#1a1a2e]/40">所属课程</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-sm font-semibold text-[#1a1a2e] leading-6">{courseNames.length > 0 ? courseNames.join("、") : "-"}</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="!text-sm text-[#1a1a2e]/40">课时统计</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold text-[#1a1a2e]">{remainingLessonHours}/{totalLessonHours}</p><p className="text-xs text-[#1a1a2e]/40 mt-1">剩余课程/总课时</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="!text-sm text-[#1a1a2e]/40">平均得分率</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold text-[#1a1a2e]">{avgScore}%</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="!text-sm text-[#1a1a2e]/40">出勤率</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold text-[#1a1a2e]">{attendanceRate}%</p></CardContent></Card>
      </div>

      <StudentDetailEditor
        initialStudent={{
          id: student.id,
          name: student.name,
          grade: student.grade,
          parentContact: student.parentContact,
          enrollmentDate: student.enrollmentDate.toISOString(),
          lessonFrequency: student.lessonFrequency,
          tuition: student.tuition,
          totalLessonHours: student.totalLessonHours,
          remainingLessonHours: student.remainingLessonHours,
          notes: student.notes,
        }}
        initialLogs={student.communicationLogs.map((log) => ({
          id: log.id,
          method: log.method,
          content: log.content,
          date: log.date.toISOString(),
        }))}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>课时历史</CardTitle>
        </CardHeader>
        <CardContent>
          {student.lessonHourLogs.length === 0 ? (
            <p className="text-sm text-[#1a1a2e]/30">暂无课时记录</p>
          ) : (
            <div className="space-y-3">
              {student.lessonHourLogs.map((log) => {
                const typeLabels: Record<string, string> = {
                  manual_add: "增加课时",
                  manual_use: "使用课时",
                  attendance_present: "出勤扣课时",
                  attendance_restore: "恢复课时",
                };
                return (
                  <div key={log.id} className="rounded-lg border border-[#1a1a2e]/5 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#1a1a2e]">
                        {typeLabels[log.type] || log.type}
                        <span className={log.deltaRemainingHours >= 0 ? "ml-2 text-green-600" : "ml-2 text-[#e07a5f]"}>
                          {log.deltaRemainingHours > 0 ? "+" : ""}{log.deltaRemainingHours}
                        </span>
                      </p>
                      <span className="text-xs text-[#1a1a2e]/40">{log.createdAt.toLocaleString("zh-CN")}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#1a1a2e]/50">
                      剩余课时 {log.beforeRemainingHours} → {log.afterRemainingHours}
                      <span className="mx-2">·</span>
                      总课时 {log.beforeTotalHours} → {log.afterTotalHours}
                    </p>
                    {log.attendance?.schedule && (
                      <p className="mt-1 text-xs text-[#1a1a2e]/40">
                        {log.attendance.date.toLocaleDateString("zh-CN")} · {log.attendance.schedule.startTime || "待定"}{log.attendance.schedule.endTime ? `-${log.attendance.schedule.endTime}` : ""}
                      </p>
                    )}
                    {log.teacherFeedback && <p className="mt-1 text-xs text-[#1a1a2e]/60">{log.teacherFeedback}</p>}
                    {log.note && <p className="mt-1 text-xs text-[#1a1a2e]/40">备注：{log.note}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>历史上课内容回顾</CardTitle>
        </CardHeader>
        <CardContent>
          {lessonReviews.length === 0 ? (
            <p className="text-sm text-[#1a1a2e]/30">暂无上课回顾</p>
          ) : (
            <div className="space-y-4">
              {lessonReviews.map((review) => {
                const contentTags = parseTags(review.contentTags);
                const feedbackTags = parseTags(review.feedbackTags);
                const weakPointTags = parseTags(review.weakPointTags);
                return (
                  <div key={review.id} className="border-b border-[#1a1a2e]/5 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a2e]">
                          {review.date.toLocaleDateString("zh-CN")} · {review.status === "makeup" ? "补课" : "出勤"}
                        </p>
                        <p className="text-xs text-[#1a1a2e]/40 mt-0.5">
                          {review.schedule.startTime || "待定"}{review.schedule.endTime ? ` - ${review.schedule.endTime}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-[#1a1a2e]/40 mb-1">上课内容</p>
                        {contentTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {contentTags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#1a1a2e]/40 mb-1">上课反馈</p>
                        {feedbackTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {feedbackTags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#1a1a2e]/40 mb-1">薄弱点</p>
                        {weakPointTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {weakPointTags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Link href={`/progress/students/${student.id}`}><Button variant="outline">查看学习进度</Button></Link>
        <Link href={`/communication/students/${student.id}`}><Button variant="outline">沟通记录</Button></Link>
      </div>
    </div>
  );
}
