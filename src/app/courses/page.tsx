import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireTeacherLike } from "@/lib/auth";

export default async function CoursesPage() {
  const user = await requireTeacherLike();
  const courses = await prisma.course.findMany({
    where: { workspaceId: user.workspaceId },
    include: { knowledgePoints: true, studentCourses: true, scheduleTimes: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="课程管理"
        description="管理课程和知识点大纲"
        action={
          <Link href="/courses/new">
            <Button>新增课程</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`}>
            <div className="glass-card rounded-xl p-5 hover:shadow-lg transition-all duration-200 cursor-pointer hover:translate-y-[-2px] h-full">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{c.description || "暂无课程说明"}</p>
                </div>
                <Badge variant={c.type === "fixed" ? "default" : "secondary"} className="whitespace-nowrap">
                  {c.type === "fixed" ? "固定课程" : "定制课程"}
                </Badge>
              </div>
              <div className="mb-4 min-h-8 text-xs text-gray-400">
                {c.scheduleTimes.length > 0
                  ? c.scheduleTimes.map((time) => `周${["日", "一", "二", "三", "四", "五", "六"][time.dayOfWeek]} ${time.startTime}-${time.endTime}`).join("、")
                  : "暂无固定时间"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 rounded-lg p-3">
                  <p className="text-[10px] text-blue-500 font-semibold">知识点</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{c.knowledgePoints.length}</p>
                </div>
                <div className="bg-orange-50/50 rounded-lg p-3">
                  <p className="text-[10px] text-orange-500 font-semibold">选课学生</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{c.studentCourses.length}</p>
                </div>
              </div>
              <p className="text-xs text-[#e07a5f] mt-4">查看详情</p>
            </div>
          </Link>
        ))}
        {courses.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-12">暂无课程数据</p>
        )}
      </div>
    </div>
  );
}
