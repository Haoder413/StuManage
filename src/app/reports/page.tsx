import { PageHeader } from "@/components/page-header";
import { StudentReportSelector } from "@/components/student-report-selector";
import { requireTeacherLike } from "@/lib/auth";
import { getStudentReportOptions } from "@/lib/student-report";

export default async function ReportsPage() {
  const user = await requireTeacherLike();
  const students = await getStudentReportOptions(user);

  return (
    <div>
      <PageHeader title="报表导出" description="按学生和时间范围生成完整学习情况 PDF 报告" />
      <StudentReportSelector students={students} />
    </div>
  );
}
