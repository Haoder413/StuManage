import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requireTeacherLike } from "@/lib/auth";
import { visibleStudentWhere } from "@/lib/teacher-visibility";
import { dedupeWeakPoints } from "@/lib/weak-points";

// 同一知识点可能同时存在 learningLinkId = NULL 的旧记录和 learningLinkId 非空的
// 新记录（家长账号/学习链接建立前后的数据），先按知识点去重再统计，否则同一
// 知识点会被计多次。mastered 优先，其次取最近更新。
function dedupeKpProgressByKnowledgePoint<T extends { knowledgePointId: string; status: string; updatedAt: Date }>(
  rows: T[],
) {
  const byKnowledgePoint = new Map<string, T>();
  for (const row of rows) {
    const existing = byKnowledgePoint.get(row.knowledgePointId);
    if (!existing) {
      byKnowledgePoint.set(row.knowledgePointId, row);
      continue;
    }
    if (row.status === "mastered" && existing.status !== "mastered") {
      byKnowledgePoint.set(row.knowledgePointId, row);
      continue;
    }
    if (row.status !== "mastered" && existing.status === "mastered") {
      continue;
    }
    if (row.updatedAt.getTime() > existing.updatedAt.getTime()) {
      byKnowledgePoint.set(row.knowledgePointId, row);
    }
  }
  return [...byKnowledgePoint.values()];
}

export default async function ProgressPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: visibleStudentWhere(user),
    include: {
      kpProgress: true,
      weakPoints: {
        where: { status: "active" },
        include: { reviewSchedules: true },
      },
      studentCourses: {
        where: { status: "active" },
        include: {
          course: {
            select: {
              _count: { select: { knowledgePoints: true } },
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
          // 与详情页口径一致：知识点总数 = 该学生实际报名的课程的知识点之和。
          // 而不是全工作区所有课程的知识点总数。
          const totalKps = s.studentCourses.reduce(
            (sum, studentCourse) => sum + studentCourse.course._count.knowledgePoints,
            0,
          );
          const kpByKnowledgePoint = dedupeKpProgressByKnowledgePoint(s.kpProgress);
          const mastered = kpByKnowledgePoint.filter((p) => p.status === "mastered").length;
          // 与详情页口径一致：learning = 知识点总数 - 已学习。
          // 包括"正在学"和"未开始"——学生还没掌握的所有知识点都视为在学习中。
          const learning = Math.max(totalKps - mastered, 0);
          const progressPct = totalKps > 0 ? Math.round((mastered / totalKps) * 100) : 0;
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

                <div className="flex gap-4 text-xs text-gray-500">
                  <span>📖 学习中 <strong className="text-blue-500">{learning}</strong></span>
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
