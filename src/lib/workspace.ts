export function workspaceWhere(workspaceId: string) {
  return { workspaceId };
}

export function workspaceData<T extends Record<string, unknown>>(workspaceId: string, data: T) {
  return { ...data, workspaceId };
}

export function assertSameWorkspace(record: { workspaceId: string } | null | undefined, workspaceId: string) {
  if (!record || record.workspaceId !== workspaceId) {
    throw new Error("record_not_found_in_workspace");
  }
}
