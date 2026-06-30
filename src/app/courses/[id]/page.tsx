import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseOutlineEditor } from "./course-outline-editor";
import { requireTeacherLike } from "@/lib/auth";
import { DeleteCourseButton } from "./delete-course-button";
import { CompleteCourseButton } from "./complete-course-button";

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const course = await prisma.course.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
    include: {
      scheduleTimes: { orderBy: { orderIndex: "asc" } },
      studentCourses: {
        where: { status: "active" },
        include: { student: true },
        orderBy: { createdAt: "desc" },
      },
      homeworkAssignments: {
        orderBy: { createdAt: "desc" },
        include: { submissions: true },
      },
    },
  });

  if (!course) notFound();
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: { workspaceId: user.workspaceId, courseId: course.id },
    orderBy: [{ parentId: "asc" }, { orderIndex: "asc" }],
  });
  const kpCount = knowledgePoints.length;
  const activeStudentCourses = Array.from(
    new Map(course.studentCourses.map((item) => [item.student.id, item])).values()
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/courses"><Button variant="outline" size="sm">返回</Button></Link>
        <div className="flex items-center gap-2">
          {course.status !== "completed" && (
            <Link href={`/courses/${course.id}/edit`}>
              <Button variant="outline" size="sm">编辑课程</Button>
            </Link>
          )}
          <CompleteCourseButton
            courseId={course.id}
            disabled={course.status === "completed"}
            students={activeStudentCourses.map((item) => ({
              id: item.id,
              studentName: item.student.name,
              studentGrade: item.student.grade,
            }))}
          />
          <DeleteCourseButton courseId={course.id} courseName={course.name} />
        </div>
      </div>
      <PageHeader
        title={course.name}
        description={`${course.type === "fixed" ? "固定课程" : "定制课程"} · ${course.status === "completed" ? "已结课" : "进行中"} · ${kpCount} 个知识点`}
      />
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>课程作业</CardTitle>
              <Link href={`/homework/new`}><Button variant="outline" size="sm">新建作业</Button></Link>
            </CardHeader>
            <CardContent>
              {course.homeworkAssignments.length === 0 ? (
                <p className="text-sm text-[#1a1a2e]/30">暂无作业</p>
              ) : (
                <div className="space-y-2">
                  {course.homeworkAssignments.slice(0, 5).map((assignment) => (
                    <Link
                      key={assignment.id}
                      href={`/homework/${assignment.id}`}
                      className="block rounded-lg border border-[#1a1a2e]/5 px-3 py-2 text-sm hover:bg-white/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1a1a2e]">{assignment.title}</span>
                        <span className="text-xs text-[#1a1a2e]/40">{assignment.status === "published" ? "已发布" : "草稿"}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#1a1a2e]/40">提交记录 {assignment.submissions.length} 条</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>选课学生</CardTitle></CardHeader>
            <CardContent>
              {activeStudentCourses.length === 0 ? (
                <p className="text-sm text-[#1a1a2e]/30">暂无学生选择该课程</p>
              ) : (
              <div className="space-y-2">
                {activeStudentCourses.map(({ student }) => (
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
