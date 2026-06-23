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
      communicationLogs: { orderBy: { date: "desc" }, take: 5 },
    },
  });

  if (!student) notFound();
  const courses = await prisma.course.findMany({
    where: { workspaceId: user.workspaceId },
    include: { scheduleTimes: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const weakPointCount = student.weakPoints.length;
  const attendanceCount = student.attendance.length;
  const presentCount = student.attendance.filter((a) => a.status === "present").length;
  const totalLessonHours = student.totalLessonHours || 0;
  const remainingLessonHours = student.remainingLessonHours || 0;
  const courseNames = student.studentCourses.map((item) => item.course.name);
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
          courseId: student.studentCourses.find((item) => item.status === "active")?.courseId || "none",
        }}
        courses={courses.map((course) => ({
          id: course.id,
          name: course.name,
          type: course.type,
          scheduleTimes: course.scheduleTimes.map((time) => ({
            dayOfWeek: time.dayOfWeek,
            startTime: time.startTime,
            endTime: time.endTime,
          })),
        }))}
        initialLogs={student.communicationLogs.map((log) => ({
          id: log.id,
          method: log.method,
          content: log.content,
          date: log.date.toISOString(),
        }))}
      />

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
