export type WeakPointStatusFilter = "all" | "pending" | "mastered";

export function normalizeWeakPointDescription(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function weakPointDescriptionKey(value: unknown) {
  return normalizeWeakPointDescription(value).toLocaleLowerCase("zh-CN");
}

export function normalizeWeakPointDescriptions(values: unknown) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const descriptions: string[] = [];

  for (const value of values) {
    const description = normalizeWeakPointDescription(value);
    if (!description || seen.has(description)) continue;
    seen.add(description);
    descriptions.push(description);
  }

  return descriptions;
}

type WeakPointReviewSchedule = {
  lastReviewedAt?: Date | string | null;
  createdAt: Date | string;
};

function reviewScheduleTime(schedule: WeakPointReviewSchedule) {
  return new Date(schedule.lastReviewedAt || schedule.createdAt).getTime();
}

export function dedupeWeakPoints<
  T extends { description: string; status: string; createdAt: Date | string; reviewSchedules: S[] },
  S extends WeakPointReviewSchedule,
>(weakPoints: T[]) {
  const byDescription = new Map<string, T>();

  for (const weakPoint of weakPoints) {
    const key = normalizeWeakPointDescription(weakPoint.description);
    const existing = byDescription.get(key);
    if (!existing) {
      byDescription.set(key, {
        ...weakPoint,
        reviewSchedules: [...weakPoint.reviewSchedules]
          .sort((a, b) => reviewScheduleTime(b) - reviewScheduleTime(a)),
      });
      continue;
    }

    const preferred = existing.status === "active" || weakPoint.status !== "active"
      ? existing
      : { ...weakPoint, reviewSchedules: [...weakPoint.reviewSchedules] };
    preferred.reviewSchedules = [...existing.reviewSchedules, ...weakPoint.reviewSchedules]
      .sort((a, b) => reviewScheduleTime(b) - reviewScheduleTime(a));
    byDescription.set(key, preferred);
  }

  return [...byDescription.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function filterWeakPointsByStatus<T extends { status: string }>(
  weakPoints: T[],
  filter: WeakPointStatusFilter,
) {
  if (filter === "pending") return weakPoints.filter((point) => point.status === "active");
  if (filter === "mastered") return weakPoints.filter((point) => point.status !== "active");
  return weakPoints;
}

export function getWeakPointStatusCounts(weakPoints: { status: string }[]) {
  const pending = weakPoints.filter((point) => point.status === "active").length;
  return {
    all: weakPoints.length,
    pending,
    mastered: weakPoints.length - pending,
  };
}
