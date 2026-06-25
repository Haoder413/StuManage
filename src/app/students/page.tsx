import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireTeacherLike } from "@/lib/auth";
import { DeleteStudentButton } from "@/components/delete-student-button";

export default async function StudentsPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    include: { studentCourses: { include: { course: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="学生管理"
        description="查看和管理所有学生"
        action={
          <Link href="/students/new">
            <Button>新增学生</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((s) => {
          const courseNames = s.studentCourses.map((item) => item.course.name);
          return (
            <div key={s.id} className="glass-card rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:translate-y-[-2px] h-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{s.grade || "未设置年级"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link className="text-xs px-2 py-1 rounded-full bg-[#e07a5f]/10 text-[#e07a5f] whitespace-nowrap" href={`/students/${s.id}`}>
                      查看详情
                    </Link>
                    <DeleteStudentButton studentId={s.id} studentName={s.name} />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400">所属课程</span>
                    <span className="text-gray-700 text-right line-clamp-2">{courseNames.length > 0 ? courseNames.join("、") : "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400">上课频次</span>
                    <span className="text-gray-700 text-right">{s.lessonFrequency || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400">入学日期</span>
                    <span className="text-gray-700 text-right">{s.enrollmentDate.toLocaleDateString("zh-CN")}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400">家长联系方式</span>
                    <span className="text-gray-700 text-right truncate max-w-[160px]">{s.parentContact || "-"}</span>
                  </div>
                </div>
            </div>
          );
        })}
        {students.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-12">暂无学生数据</p>
        )}
      </div>
    </div>
  );
}
