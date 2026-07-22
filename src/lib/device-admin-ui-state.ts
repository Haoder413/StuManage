import {
  forceLogoutAll,
  forceLogoutDevice,
  getAccountDevices,
  getDevicePolicy,
  limitsToDraft,
  parseGlobalLimitDraft,
  parseOverrideLimitDraft,
  saveAccountOverride,
  saveDevicePolicy,
  type AccountDevice,
  type AccountDevicesResponse,
  type DeviceLimitDraft,
  type FetchLike,
} from "./device-admin-client";
import type { DeviceLimits } from "./device-session-policy";

export type AsyncPanelState<T> =
  | { phase: "loading" }
  | { phase: "success"; data: T }
  | { phase: "error"; message: string };

export type PanelStateEmitter<T> = (state: AsyncPanelState<T>) => void;
export type RefreshPanel = () => Promise<boolean>;
export type ConfirmAction = (message: string) => boolean;
export type LatestRequestGate = {
  begin(): number;
  isCurrent(generation: number): boolean;
  invalidate(): void;
};
export type OperationLock = {
  tryStart(): boolean;
  finish(): void;
  pending(): boolean;
};

export function createLatestRequestGate(): LatestRequestGate {
  let generation = 0;
  return {
    begin() { generation += 1; return generation; },
    isCurrent(value) { return value === generation; },
    invalidate() { generation += 1; },
  };
}

export function createOperationLock(): OperationLock {
  let locked = false;
  return {
    tryStart() {
      if (locked) return false;
      locked = true;
      return true;
    },
    finish() { locked = false; },
    pending() { return locked; },
  };
}

export function shouldAcceptDeviceDialogOpenChange(nextOpen: boolean, pending: boolean): boolean {
  return nextOpen || !pending;
}

export async function runOperationWithLock<T>(
  lock: OperationLock,
  setPending: (pending: boolean) => void,
  work: () => Promise<T>,
): Promise<{ started: false } | { started: true; value: T }> {
  if (!lock.tryStart()) return { started: false };
  setPending(true);
  try {
    return { started: true, value: await work() };
  } finally {
    lock.finish();
    setPending(false);
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function sortDevicesActiveFirst(devices: AccountDevice[]): AccountDevice[] {
  return [...devices].sort(
    (left, right) => right.activeSessionCount - left.activeSessionCount
      || new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime(),
  );
}

export function deviceListKind(devices: AccountDevice[]): "empty" | "list" {
  return devices.length === 0 ? "empty" : "list";
}

export async function loadAccountDevicePanel(
  fetcher: FetchLike,
  accountId: string,
  emit: PanelStateEmitter<AccountDevicesResponse>,
  gate?: LatestRequestGate,
): Promise<boolean> {
  const generation = gate?.begin();
  emit({ phase: "loading" });
  try {
    const data = await getAccountDevices(fetcher, accountId);
    if (generation !== undefined && !gate?.isCurrent(generation)) return false;
    emit({ phase: "success", data: { ...data, devices: sortDevicesActiveFirst(data.devices) } });
    return true;
  } catch (error) {
    if (generation !== undefined && !gate?.isCurrent(generation)) return false;
    emit({ phase: "error", message: errorMessage(error, "加载设备失败") });
    return false;
  }
}

export async function loadGlobalPolicyPanel(
  fetcher: FetchLike,
  emit: PanelStateEmitter<DeviceLimits>,
): Promise<boolean> {
  emit({ phase: "loading" });
  try {
    emit({ phase: "success", data: await getDevicePolicy(fetcher) });
    return true;
  } catch (error) {
    emit({ phase: "error", message: errorMessage(error, "加载设备上限失败") });
    return false;
  }
}

export async function logoutSingleDevice({
  fetcher,
  accountId,
  deviceId,
  displayName,
  confirm,
  refresh,
}: {
  fetcher: FetchLike;
  accountId: string;
  deviceId: string;
  displayName: string;
  confirm: ConfirmAction;
  refresh: RefreshPanel;
}): Promise<string | null> {
  if (!confirm(`确认让“${displayName}”退出登录？该设备需要重新输入账号密码。`)) return null;
  const result = await forceLogoutDevice(fetcher, accountId, deviceId);
  if (!await refresh()) return null;
  return result.deletedSessions > 0 ? "该设备已强制下线" : "该设备当前没有有效登录";
}

export async function logoutAccountDevices({
  fetcher,
  accountId,
  accountName,
  confirm,
  refresh,
}: {
  fetcher: FetchLike;
  accountId: string;
  accountName: string;
  confirm: ConfirmAction;
  refresh: RefreshPanel;
}): Promise<string | null> {
  if (!confirm(`确认让“${accountName}”的所有设备退出登录？网页端和小程序都需要重新登录。`)) return null;
  const result = await forceLogoutAll(fetcher, accountId);
  if (!await refresh()) return null;
  return result.deletedSessions > 0 ? `已退出 ${result.deletedSessions} 个有效登录` : "该账号当前没有有效登录";
}

export async function saveOverrideDraft(
  fetcher: FetchLike,
  accountId: string,
  draft: DeviceLimitDraft,
  refresh: RefreshPanel,
): Promise<string | null> {
  await saveAccountOverride(fetcher, accountId, parseOverrideLimitDraft(draft));
  return await refresh() ? "已保存该账号的设备上限" : null;
}

export async function restoreAccountDefaults(
  fetcher: FetchLike,
  accountId: string,
  refresh: RefreshPanel,
): Promise<string | null> {
  await saveAccountOverride(fetcher, accountId, parseOverrideLimitDraft(limitsToDraft(null)));
  return await refresh() ? "已恢复使用全局默认上限" : null;
}

export async function saveGlobalPolicyDraft(fetcher: FetchLike, draft: DeviceLimitDraft) {
  const data = await saveDevicePolicy(fetcher, parseGlobalLimitDraft(draft));
  return { data, message: "已保存全局设备上限" };
}
