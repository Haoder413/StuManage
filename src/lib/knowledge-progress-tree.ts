export type KnowledgePointParent = {
  id: string;
  parentId: string | null;
};

export type KnowledgeProgressStatus = "learning" | "mastered";

export type AncestorProgressUpdate = {
  knowledgePointId: string;
  status: KnowledgeProgressStatus;
};

export type StoredKnowledgeProgress = {
  knowledgePointId: string;
  status: string;
  learningLinkId: string | null;
};

export function buildEffectiveProgressStatuses(
  progress: StoredKnowledgeProgress[],
  preferredLearningLinkId?: string | null,
) {
  const statuses: Record<string, string> = {};
  const ordered = [...progress].sort((a, b) => {
    const priority = (item: StoredKnowledgeProgress) => {
      if (preferredLearningLinkId && item.learningLinkId === preferredLearningLinkId) return 2;
      if (item.learningLinkId) return 1;
      return 0;
    };
    return priority(a) - priority(b);
  });

  for (const item of ordered) statuses[item.knowledgePointId] = item.status;
  return statuses;
}

export function calculateAncestorProgressUpdates(
  points: KnowledgePointParent[],
  statuses: Record<string, string>,
  changedKnowledgePointId: string,
): AncestorProgressUpdate[] {
  const pointById = new Map(points.map((point) => [point.id, point]));
  const childrenByParentId = new Map<string, string[]>();
  const nextStatuses = { ...statuses };
  const updates: AncestorProgressUpdate[] = [];

  for (const point of points) {
    if (!point.parentId) continue;
    childrenByParentId.set(point.parentId, [
      ...(childrenByParentId.get(point.parentId) || []),
      point.id,
    ]);
  }

  let parentId = pointById.get(changedKnowledgePointId)?.parentId || null;
  while (parentId) {
    const childIds = childrenByParentId.get(parentId) || [];
    const status: KnowledgeProgressStatus = childIds.length > 0 && childIds.every((id) => nextStatuses[id] === "mastered")
      ? "mastered"
      : "learning";

    if (nextStatuses[parentId] !== status) {
      nextStatuses[parentId] = status;
      updates.push({ knowledgePointId: parentId, status });
    }
    parentId = pointById.get(parentId)?.parentId || null;
  }

  return updates;
}
