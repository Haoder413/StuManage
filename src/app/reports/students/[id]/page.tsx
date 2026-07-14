import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StudentReportPrintButton } from "@/components/student-report-print-button";
import { requireTeacherLike } from "@/lib/auth";
import { getStudentReport } from "@/lib/student-report";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-CN");
}

function money(value: string | null) {
  return value || "-";
}

function attendanceLabel(status: string) {
  return ({ present: "出勤", absent: "请假/缺席", makeup: "补课" } as Record<string, string>)[status] || status;
}

function weakPointStatus(status: string) {
  return status === "active" ? "待复习" : "已掌握";
}

function EmptyRow({ columns, text = "暂无记录" }: { columns: number; text?: string }) {
  return <tr><td colSpan={columns} className="py-5 text-center text-slate-400">{text}</td></tr>;
}

export default async function StudentReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireTeacherLike();
  const report = await getStudentReport(user, params.id, {
    version: first(searchParams.version),
    from: first(searchParams.from),
    to: first(searchParams.to),
  });
  if (!report) notFound();

  const isInternal = report.version === "internal";
  const courses = report.studentCourses.map((item) => item.course);
  const teacherNames = [...new Set(report.learningLinks.map((item) => item.teacher.name))];
  const knowledgeByCourse = new Map<string, typeof report.knowledgePoints>();
  report.knowledgePoints.forEach((point) => {
    const items = knowledgeByCourse.get(point.courseName) || [];
    items.push(point);
    knowledgeByCourse.set(point.courseName, items);
  });

  return (
    <main className="mx-auto max-w-5xl bg-white px-5 py-6 text-slate-800 sm:px-8 print:max-w-none print:p-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        .report-title { font-size: 18px; line-height: 1.5; font-weight: 700; color: #0f172a; }
        .table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
        .table-wrap table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .table-wrap th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; }
        .table-wrap th, .table-wrap td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .table-wrap tbody tr:last-child td { border-bottom: 0; }
        .empty-block { margin-top: 12px; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; color: #94a3b8; }
        @media print {
          body { background: white !important; }
          aside, .report-actions { display: none !important; }
          .report-section { break-inside: avoid; }
          .report-page-break { break-before: page; }
          .table-wrap { overflow: visible; }
          table { font-size: 10px; }
        }
      `}</style>

      <div className="report-actions mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Link href="/reports"><Button variant="outline">← 返回报表设置</Button></Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">请在打印窗口中选择“存储为 PDF”</span>
          <StudentReportPrintButton />
        </div>
      </div>

      <header className="border-b-2 border-sky-500 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-600">{isInternal ? "教师内部版" : "家长版"}</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{report.student.name} · 学习情况报告</h1>
            <p className="mt-2 text-sm text-slate-500">统计周期：{report.range.label}</p>
          </div>
          <div className="text-right text-xs leading-6 text-slate-500">
            <p>年级：{report.student.grade || "-"}</p>
            <p>生成时间：{new Date(report.generatedAt).toLocaleString("zh-CN")}</p>
          </div>
        </div>
      </header>

      <section className="report-section mt-6">
        <h2 className="report-title">一、学习概览</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["课堂次数", report.summary.lessonCount],
            ["出勤率", `${report.summary.attendanceRate}%`],
            ["平均得分率", `${report.summary.averageScoreRate}%`],
            ["作业记录", report.summary.homeworkCount],
            ["已掌握知识点", `${report.summary.masteredKnowledgeCount}/${report.summary.knowledgeCount}`],
            ["待复习薄弱点", report.summary.activeWeakPointCount],
            ["已掌握薄弱点", report.summary.masteredWeakPointCount],
            ["完成复习", report.summary.completedReviewCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="report-section mt-7">
        <h2 className="report-title">二、课程与教师</h2>
        <div className="mt-3 rounded-lg border border-slate-200 p-4 text-sm leading-7">
          <p><span className="text-slate-500">课程：</span>{courses.length ? courses.map((course) => course.name).join("、") : "暂无"}</p>
          <p><span className="text-slate-500">教师：</span>{teacherNames.length ? teacherNames.join("、") : "暂无"}</p>
          <p><span className="text-slate-500">学科：</span>{[...new Set(report.learningLinks.map((item) => item.subject))].join("、") || "暂无"}</p>
        </div>
      </section>

      {isInternal && (
        <section className="report-section mt-7 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-lg font-bold">内部档案信息</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>家长联系方式：{report.student.parentContact || "-"}</p>
            <p>学费：{money(report.student.tuition)}</p>
            <p>总课时：{report.student.totalLessonHours}</p>
            <p>剩余课时：{report.student.remainingLessonHours}</p>
            <p className="sm:col-span-2">内部备注：{report.student.notes || "-"}</p>
          </div>
        </section>
      )}

      <section className="report-section mt-7">
        <h2 className="report-title">三、课堂与考勤</h2>
        <div className="table-wrap mt-3"><table><thead><tr><th>日期</th><th>课程</th><th>状态</th><th>上课内容</th><th>教师反馈</th></tr></thead><tbody>
          {report.attendance.length === 0 ? <EmptyRow columns={5} /> : report.attendance.map((item) => <tr key={item.id}><td>{dateLabel(item.date)}</td><td>{item.learningLink?.course?.name || item.schedule.course?.name || "-"}</td><td>{attendanceLabel(item.status)}</td><td>{item.lessonContent || item.notes || "-"}</td><td>{item.lessonFeedback || "-"}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="report-section mt-7">
        <h2 className="report-title">四、考试成绩</h2>
        <div className="table-wrap mt-3"><table><thead><tr><th>日期</th><th>考试</th><th>类型</th><th>成绩</th><th>得分率</th><th>备注</th></tr></thead><tbody>
          {report.exams.length === 0 ? <EmptyRow columns={6} /> : report.exams.map((exam) => <tr key={exam.id}><td>{dateLabel(exam.date)}</td><td>{exam.name}</td><td>{exam.type}</td><td>{exam.score}/{exam.totalScore}</td><td>{exam.totalScore > 0 ? `${Math.round(exam.score / exam.totalScore * 100)}%` : "-"}</td><td>{exam.notes || "-"}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="report-section mt-7">
        <h2 className="report-title">五、作业情况</h2>
        <div className="table-wrap mt-3"><table><thead><tr><th>作业</th><th>课程</th><th>截止时间</th><th>状态</th><th>提交次数</th><th>得分</th><th>总评</th></tr></thead><tbody>
          {report.homework.length === 0 ? <EmptyRow columns={7} /> : report.homework.map((item) => <tr key={item.id}><td>{item.assignment.title}</td><td>{item.assignment.course.name}</td><td>{dateLabel(item.assignment.dueAt)}</td><td>{item.status}</td><td>{item.currentVersion?.versionNumber || 0}</td><td>{item.totalScore ?? item.currentVersion?.totalScore ?? "-"}</td><td>{item.overallComment || item.currentVersion?.overallComment || "-"}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="report-page-break mt-7">
        <h2 className="report-title">六、知识点进度</h2>
        {knowledgeByCourse.size === 0 ? <p className="empty-block">暂无知识点记录</p> : [...knowledgeByCourse.entries()].map(([courseName, points]) => (
          <div key={courseName} className="report-section mt-4">
            <h3 className="font-semibold text-slate-700">{courseName}</h3>
            <div className="table-wrap mt-2"><table><thead><tr><th>知识点</th><th>状态</th><th>掌握时间</th></tr></thead><tbody>
              {points.map((point) => <tr key={point.id}><td>{point.parentId ? `└ ${point.name}` : point.name}</td><td>{point.status === "mastered" ? "已学习" : "学习中"}</td><td>{dateLabel(point.masteredAt)}</td></tr>)}
            </tbody></table></div>
          </div>
        ))}
      </section>

      <section className="report-section mt-7">
        <h2 className="report-title">七、薄弱点与复习</h2>
        <div className="table-wrap mt-3"><table><thead><tr><th>薄弱点</th><th>状态</th><th>发现时间</th><th>完成复习</th><th>最近复习</th><th>下次复习</th></tr></thead><tbody>
          {report.weakPoints.length === 0 ? <EmptyRow columns={6} /> : report.weakPoints.map((point) => {
            const completed = point.reviewSchedules.filter((item) => item.status === "completed");
            const last = [...completed].sort((a, b) => (b.lastReviewedAt?.getTime() || 0) - (a.lastReviewedAt?.getTime() || 0))[0];
            const next = point.reviewSchedules.find((item) => item.status === "pending");
            return <tr key={point.id}><td>{point.description}</td><td>{weakPointStatus(point.status)}</td><td>{dateLabel(point.createdAt)}</td><td>{completed.length}</td><td>{dateLabel(last?.lastReviewedAt)}</td><td>{dateLabel(next?.nextReviewAt)}</td></tr>;
          })}
        </tbody></table></div>
      </section>

      {isInternal && (
        <section className="report-section mt-7">
          <h2 className="report-title">八、课时流水（内部）</h2>
          <div className="table-wrap mt-3"><table><thead><tr><th>日期</th><th>类型</th><th>总课时变化</th><th>剩余课时变化</th><th>备注</th></tr></thead><tbody>
            {report.lessonHourLogs.length === 0 ? <EmptyRow columns={5} /> : report.lessonHourLogs.map((item) => <tr key={item.id}><td>{dateLabel(item.createdAt)}</td><td>{item.type}</td><td>{item.deltaTotalHours > 0 ? "+" : ""}{item.deltaTotalHours}</td><td>{item.deltaRemainingHours > 0 ? "+" : ""}{item.deltaRemainingHours}</td><td>{item.note || item.teacherFeedback || "-"}</td></tr>)}
          </tbody></table></div>
        </section>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-400">
        <p>说明：报告仅统计选定时间范围内的课堂、考试、作业、复习和课时明细；考试仅包含已审核记录，重复考勤已合并。</p>
      </footer>
    </main>
  );
}
