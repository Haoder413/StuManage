import { requireParent } from "@/lib/auth";
import { getParentStudents } from "@/lib/parent-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParentPage() {
  const user = await requireParent();
  const parentStudents = await getParentStudents(user);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">孩子首页</h1>
        <p className="mt-1 text-sm text-slate-500">孩子概览、最近上课、最近成绩和课程安排</p>
      </div>

      <div className="grid gap-4">
        {parentStudents.map(({ student }) => {
          const latestAttendance = student.attendance.slice(0, 3);
          const latestExams = student.exams.slice(0, 3);
          const courseNames = student.studentCourses.map((item) => item.course.name);

          return (
            <section key={student.id} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="p-4"><CardTitle className="!text-sm text-slate-500">学生</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xl font-bold text-slate-900">{student.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{student.grade || "未填写年级"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4"><CardTitle className="!text-sm text-slate-500">剩余课时</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0"><p className="text-2xl font-bold text-slate-900">{student.remainingLessonHours}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4"><CardTitle className="!text-sm text-slate-500">所属课程</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0"><p className="text-sm font-semibold text-slate-900">{courseNames.length ? courseNames.join("、") : "-"}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4"><CardTitle className="!text-sm text-slate-500">当前薄弱点</CardTitle></CardHeader>
                  <CardContent className="p-4 pt-0"><p className="text-2xl font-bold text-slate-900">{student.weakPoints.length}</p></CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle>最近上课</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {latestAttendance.length === 0 ? <p className="text-slate-400">暂无记录</p> : latestAttendance.map((item) => (
                      <p key={item.id} className="text-slate-600">{item.date.toLocaleDateString("zh-CN")} · {statusLabel(item.status)}</p>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>最近成绩</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {latestExams.length === 0 ? <p className="text-slate-400">暂无记录</p> : latestExams.map((exam) => (
                      <p key={exam.id} className="text-slate-600">{exam.name} · {exam.score}/{exam.totalScore}</p>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>课程安排</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {student.schedules.length === 0 ? <p className="text-slate-400">暂无安排</p> : student.schedules.slice(0, 3).map((schedule) => (
                      <p key={schedule.id} className="text-slate-600">{schedule.type === "fixed" ? "固定" : "灵活"} · {schedule.dayOfWeek !== null ? `周${schedule.dayOfWeek}` : schedule.date?.toLocaleDateString("zh-CN")} · {schedule.startTime || "待定"}-{schedule.endTime || "待定"}</p>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "present") return "出勤";
  if (status === "makeup") return "补课";
  return "请假";
}
