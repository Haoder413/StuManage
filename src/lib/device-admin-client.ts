import {
  DEVICE_LIMIT_KEYS,
  type DeviceLimitKey,
  type DeviceLimits,
} from "./device-session-policy";

export type DeviceLimitDraft = Record<DeviceLimitKey, string>;
export type DeviceLimitOverride = Record<DeviceLimitKey, number | null>;
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const DEVICE_LIMIT_GROUPS = [
  {
    channel: "web",
    title: "网页端",
    fields: [
      { key: "webMobile", label: "手机" },
      { key: "webDesktop", label: "电脑" },
      { key: "webTablet", label: "平板" },
    ],
  },
  {
    channel: "miniProgram",
    title: "小程序",
    fields: [
      { key: "miniMobile", label: "手机" },
      { key: "miniDesktop", label: "电脑" },
      { key: "miniTablet", label: "平板" },
    ],
  },
] as const;

export type AccountDevice = {
  id: string;
  channel: "web" | "miniProgram";
  deviceType: "mobile" | "desktop" | "tablet";
  displayName: string;
  browser: string | null;
  operatingSystem: string | null;
  lastIpAddress: string | null;
  firstSeenAt: string;
  lastLoginAt: string;
  lastSeenAt: string;
  lastLogoutAt: string | null;
  activeSessionCount: number;
};

export type AccountDevicesResponse = {
  account: { id: string; name: string; phone: string | null; email: string | null; role: string };
  globalPolicy: DeviceLimits;
  override: DeviceLimitOverride | null;
  effectivePolicy: DeviceLimits;
  devices: AccountDevice[];
};

function parseDraftValue(value: string, allowEmpty: boolean): number | null {
  const normalized = value.trim();
  if (allowEmpty && normalized === "") return null;
  if (!/^\d+$/.test(normalized)) throw new Error("请填写 1 至 20 的整数");
  const parsed = Number(normalized);
  if (parsed < 1 || parsed > 20) throw new Error("请填写 1 至 20 的整数");
  return parsed;
}

export function parseGlobalLimitDraft(draft: DeviceLimitDraft): DeviceLimits {
  return Object.fromEntries(
    DEVICE_LIMIT_KEYS.map((key) => [key, parseDraftValue(draft[key], false)]),
  ) as DeviceLimits;
}

export function parseOverrideLimitDraft(draft: DeviceLimitDraft): DeviceLimitOverride {
  return Object.fromEntries(
    DEVICE_LIMIT_KEYS.map((key) => [key, parseDraftValue(draft[key], true)]),
  ) as DeviceLimitOverride;
}

export function limitsToDraft(value: Partial<Record<DeviceLimitKey, number | null>> | null): DeviceLimitDraft {
  return Object.fromEntries(
    DEVICE_LIMIT_KEYS.map((key) => [key, value?.[key] == null ? "" : String(value[key])]),
  ) as DeviceLimitDraft;
}

async function requestJson<T>(fetcher: FetchLike, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, init);
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
  return data;
}

function jsonInit(method: "PATCH" | "DELETE", body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

export function getAccountDevices(fetcher: FetchLike, accountId: string) {
  return requestJson<AccountDevicesResponse>(fetcher, `/api/admin/accounts/${encodeURIComponent(accountId)}/devices`);
}

export function saveAccountOverride(fetcher: FetchLike, accountId: string, value: DeviceLimitOverride) {
  return requestJson<{ override: DeviceLimitOverride | null }>(
    fetcher,
    `/api/admin/accounts/${encodeURIComponent(accountId)}/devices`,
    jsonInit("PATCH", value),
  );
}

export function forceLogoutDevice(fetcher: FetchLike, accountId: string, deviceId: string) {
  return requestJson<{ success: true; deletedSessions: number }>(
    fetcher,
    `/api/admin/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(deviceId)}`,
    jsonInit("DELETE"),
  );
}

export function forceLogoutAll(fetcher: FetchLike, accountId: string) {
  return requestJson<{ success: true; deletedSessions: number }>(
    fetcher,
    `/api/admin/accounts/${encodeURIComponent(accountId)}/sessions`,
    jsonInit("DELETE"),
  );
}

export function getDevicePolicy(fetcher: FetchLike) {
  return requestJson<DeviceLimits>(fetcher, "/api/admin/device-policy");
}

export function saveDevicePolicy(fetcher: FetchLike, value: DeviceLimits) {
  return requestJson<DeviceLimits>(fetcher, "/api/admin/device-policy", jsonInit("PATCH", value));
}
