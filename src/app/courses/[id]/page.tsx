import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseOutlineEditor } from "./course-outline-editor";
import { requireTeacherLike } from "@/lib/auth";
import { DeleteCourseButton } from "./delete-course-button";

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const course = await prisma.course.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      studentCourses: {
        include: { student: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!course) notFound();
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: { workspaceId: user.workspaceId, courseId: course.id },
    orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }],
  });
  const kpCount = knowledgePoints.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/courses"><Button variant="outline" size="sm">返回</Button></Link>
        <DeleteCourseButton courseId={course.id} courseName={course.name} />
      </div>
      <PageHeader title={course.name} description={`${course.type === "fixed" ? "固定课程" : "定制课程"} · ${kpCount} 个知识点`} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardHeader><CardTitle>知识点大纲</CardTitle></CardHeader>
          <CardContent>
            <CourseOutlineEditor courseId={course.id} initialKnowledgePoints={knowledgePoints} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>课程时间</CardTitle></CardHeader>
            <CardContent>
              {course.scheduleTimes.length === 0 ? (
                <p className="text-sm text-[#1a1a2e]/30">暂无固定时间</p>
              ) : (
                <div className="space-y-2 text-sm text-[#1a1a2e]/70">
                  {course.scheduleTimes.map((time) => (
                    <p key={time.id}>周{["日", "一", "二", "三", "四", "五", "六"][time.dayOfWeek]} · {time.startTime}-{time.endTime}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>选课学生</CardTitle></CardHeader>
            <CardContent>
              {course.studentCourses.length === 0 ? (
                <p className="text-sm text-[#1a1a2e]/30">暂无学生选择该课程</p>
              ) : (
              <div className="space-y-2">
                {course.studentCourses.map(({ student }) => (
                  <Link
                    key={student.id}
                    href={`/students/${student.id}`}
                    className="flex items-center justify-between rounded-lg border border-[#1a1a2e]/5 px-3 py-2 text-sm hover:bg-white/50"
                  >
                    <span className="font-medium text-[#1a1a2e]">{student.name}</span>
                    <span className="text-xs text-[#1a1a2e]/40">{student.grade || "未设置年级"}</span>
                  </Link>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
