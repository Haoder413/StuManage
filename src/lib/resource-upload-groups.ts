export type EditableUploadGroup = {
  groupKey: string;
  title: string;
  grade: string | null;
  year: number | null;
  subject: string | null;
  resourceKind: "paper" | "animation" | "material";
  tags: string[];
  confidence: number;
  needsConfirmation: boolean;
  reason: string;
  courseIds: string[];
  files: Array<{ originalName: string; role: "student" | "answer" | "supplement" }>;
};

export function createUniqueUploadGroupKey(groups: EditableUploadGroup[], preferred: string) {
  const used = new Set(groups.map((group) => group.groupKey));
  if (!used.has(preferred)) return preferred;
  let sequence = 2;
  while (used.has(`${preferred}-${sequence}`)) sequence += 1;
  return `${preferred}-${sequence}`;
}

export function mergeUploadGroup(
  groups: EditableUploadGroup[],
  sourceKey: string,
  targetKey: string
) {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return groups;
  const source = groups.find((group) => group.groupKey === sourceKey);
  const target = groups.find((group) => group.groupKey === targetKey);
  if (!source || !target) return groups;

  const merged: EditableUploadGroup = {
    ...target,
    files: [...target.files, ...source.files],
    tags: Array.from(new Set([...target.tags, ...source.tags])).slice(0, 10),
    courseIds: Array.from(new Set([...target.courseIds, ...source.courseIds])),
    needsConfirmation: true,
    reason: "已手动合并，请确认版本类型",
  };
  return groups.flatMap((group) => {
    if (group.groupKey === sourceKey) return [];
    if (group.groupKey === targetKey) return [merged];
    return [group];
  });
}
