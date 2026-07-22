export type ProgressCourseOption = {
  id: string;
  name: string;
  updatedAt: string | Date;
  lastProgressAt: string | Date | null;
};

export type TeacherProgressRow = {
  knowledgePointId: string;
  status: string;
  updatedAt: string | Date;
  learningLinkId?: string | null;
};

export type TeacherProgressPoint = {
  id: string;
  parentId: string | null;
};

function timestamp(value: string | Date | null) {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortTeacherProgressCourses<T extends ProgressCourseOption>(courses: T[]) {
  return [...courses].sort((left, right) => {
    const leftProgress = timestamp(left.lastProgressAt);
    const rightProgress = timestamp(right.lastProgressAt);
    if (leftProgress || rightProgress) {
      if (!leftProgress) return 1;
      if (!rightProgress) return -1;
      if (leftProgress !== rightProgress) return rightProgress - leftProgress;
    }

    const updatedDifference = timestamp(right.updatedAt) - timestamp(left.updatedAt);
    if (updatedDifference !== 0) return updatedDifference;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

export function resolveTeacherProgressCourse(
  courses: ProgressCourseOption[],
  storedCourseId: string | null,
) {
  if (storedCourseId && courses.some((course) => course.id === storedCourseId)) {
    return storedCourseId;
  }
  return sortTeacherProgressCourses(courses)[0]?.id ?? null;
}

export function dedupeTeacherProgress<T extends TeacherProgressRow>(rows: T[]) {
  const byKnowledgePoint = new Map<string, T>();
  for (const row of rows) {
    const existing = byKnowledgePoint.get(row.knowledgePointId);
    if (!existing) {
      byKnowledgePoint.set(row.knowledgePointId, row);
      continue;
    }
    const rowPriority = row.learningLinkId ? 1 : 0;
    const existingPriority = existing.learningLinkId ? 1 : 0;
    if (rowPriority > existingPriority) {
      byKnowledgePoint.set(row.knowledgePointId, row);
      continue;
    }
    if (rowPriority < existingPriority) continue;
    if (timestamp(row.updatedAt) > timestamp(existing.updatedAt)) {
      byKnowledgePoint.set(row.knowledgePointId, row);
    }
  }
  return [...byKnowledgePoint.values()];
}

export function summarizeTeacherProgress(total: number, rows: TeacherProgressRow[]) {
  const effective = dedupeTeacherProgress(rows);
  const mastered = effective.filter((row) => row.status === "mastered").length;
  const learning = effective.filter((row) => row.status === "learning").length;
  return {
    total,
    mastered,
    learning,
    notStarted: Math.max(total - mastered - learning, 0),
    progressPct: total > 0 ? Math.round((mastered / total) * 100) : 0,
  };
}

export function calculateConsistentTeacherProgressStatuses(
  points: TeacherProgressPoint[],
  statuses: Record<string, string>,
) {
  const pointIds = new Set(points.map((point) => point.id));
  const childrenByParentId = new Map<string, string[]>();
  const result: Record<string, string> = {};
  const visiting = new Set<string>();

  for (const point of points) {
    if (!point.parentId || !pointIds.has(point.parentId)) continue;
    childrenByParentId.set(point.parentId, [
      ...(childrenByParentId.get(point.parentId) || []),
      point.id,
    ]);
  }

  const normalized = (id: string) => {
    if (statuses[id] === "mastered") return "mastered";
    if (statuses[id] === "learning") return "learning";
    return "not_started";
  };

  const resolve = (id: string): string => {
    if (result[id]) return result[id];
    if (visiting.has(id)) return normalized(id);
    visiting.add(id);
    const children = childrenByParentId.get(id) || [];
    const childStatuses = children.map(resolve);
    const status = childStatuses.length === 0
      ? normalized(id)
      : childStatuses.every((childStatus) => childStatus === "mastered")
        ? "mastered"
        : childStatuses.every((childStatus) => childStatus === "not_started")
          ? "not_started"
          : "learning";
    visiting.delete(id);
    result[id] = status;
    return status;
  };

  for (const point of points) resolve(point.id);
  return result;
}
