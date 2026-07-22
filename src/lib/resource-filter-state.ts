export function mergeResourceFilterParams(base: string, update: Record<string, string>) {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(update)) {
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
  }
  params.delete("page");
  return params.toString();
}

export function shouldSyncObservedResourceParams(
  observed: string,
  target: string,
  pendingTargets: ReadonlySet<string>,
  externalNavigation: boolean,
) {
  if (externalNavigation) return true;
  return observed !== target && !pendingTargets.has(observed);
}

export function parseResourceYearInput(input: string) {
  const value = input.trim();
  if (!value) return { year: "", error: "" };
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < 1900 || year > 2100) {
    return { year: null, error: "请输入 1900—2100 的年份" };
  }
  return { year: value, error: "" };
}
