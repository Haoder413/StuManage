import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requireTeacherLike } from "@/lib/auth";
import {
  calculateConsistentTeacherProgressStatuses,
  dedupeTeacherProgress,
  summarizeTeacherProgress,
} from "@/lib/teacher-progress";
import {
  teacherSeesAllWorkspaceData,
  visibleProgressCourseWhere,
  visibleProgressStudentWhere,
  visibleProgressWeakPointWhere,
} from "@/lib/teacher-visibility";
import { dedupeWeakPoints } from "@/lib/weak-points";

export default async function ProgressPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: visibleProgressStudentWhere(user),
    include: {
      kpProgress: {
        where: {
          knowledgePoint: { course: visibleProgressCourseWhere(user) },
          ...(teacherSeesAllWorkspaceData(user)
            ? {}
            : {
                OR: [
                  {
                    learningLink: {
                      workspaceId: user.workspaceId,
                      teacherId: user.id,
                      isActive: true,
                      ...(user.teachingSubject?.trim() ? { subject: user.teachingSubject.trim() } : {}),
                    },
                  },
                  { learningLinkId: null },
                ],
              }),
        },
        include: { knowledgePoint: { select: { courseId: true } } },
      },
      weakPoints: {
        where: {
          ...visibleProgressWeakPointWhere(user),
          status: "active",
        },
        include: { reviewSchedules: true },
      },
      studentCourses: {
        where: { status: "active", course: visibleProgressCourseWhere(user) },
        include: {
          course: {
            select: {
              id: true,
              knowledgePoints: { select: { id: true, parentId: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader title="学习进度" description="查看和编辑所有学生的学习进度" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map((s) => {
          const activeCourseIds = new Set(s.studentCourses.map((studentCourse) => studentCourse.course.id));
          const coursePoints = s.studentCourses.flatMap((studentCourse) => studentCourse.course.knowledgePoints);
          const activeProgress = dedupeTeacherProgress(
            s.kpProgress.filter((row) => activeCourseIds.has(row.knowledgePoint.courseId)),
          );
          const consistentStatuses = calculateConsistentTeacherProgressStatuses(
            coursePoints,
            Object.fromEntries(activeProgress.map((row) => [row.knowledgePointId, row.status])),
          );
          const normalizedProgress = coursePoints.map((point) => ({
            knowledgePointId: point.id,
            status: consistentStatuses[point.id] || "not_started",
            updatedAt: new Date(0),
          }));
          const totalKps = coursePoints.length;
          const { mastered, learning, notStarted, progressPct } = summarizeTeacherProgress(
            totalKps,
            normalizedProgress,
          );
          const activeWeak = dedupeWeakPoints(s.weakPoints).length;

          return (
            <Link key={s.id} href={`/progress/students/${s.id}`}>
              <div className="glass-card rounded-xl p-5 hover:shadow-lg transition-all duration-200 cursor-pointer hover:translate-y-[-2px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                  <span className="text-xs text-gray-400">{s.grade || ""}</span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>知识点已学习</span>
                    <span>{mastered}/{totalKps} ({progressPct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>📖 学习中 <strong className="text-blue-500">{learning}</strong></span>
                  <span>⏳ 未开始 <strong className="text-gray-500">{notStarted}</strong></span>
                  <span>⚠️ 薄弱点 <strong className="text-orange-500">{activeWeak}</strong></span>
                </div>
              </div>
            </Link>
          );
        })}
        {students.length === 0 && (
          <p className="text-sm text-gray-400 col-span-3 text-center py-12">暂无学生数据</p>
        )}
      </div>
    </div>
  );
}
