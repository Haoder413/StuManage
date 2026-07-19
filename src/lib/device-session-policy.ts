export type DeviceChannel = "web" | "miniProgram";
export type DeviceType = "mobile" | "desktop" | "tablet";

export const DEVICE_LIMIT_KEYS = [
  "webMobile",
  "webDesktop",
  "webTablet",
  "miniMobile",
  "miniDesktop",
  "miniTablet",
] as const;

export type DeviceLimitKey = (typeof DEVICE_LIMIT_KEYS)[number];
export type DeviceLimits = Record<DeviceLimitKey, number>;
export type DeviceLimitOverrides = Partial<Record<DeviceLimitKey, number | null>>;

const DEVICE_LIMIT_KEY_SET: ReadonlySet<string> = new Set(DEVICE_LIMIT_KEYS);

export const DEFAULT_DEVICE_LIMITS: Readonly<DeviceLimits> = Object.freeze({
  webMobile: 2,
  webDesktop: 2,
  webTablet: 2,
  miniMobile: 2,
  miniDesktop: 2,
  miniTablet: 2,
});

const LIMIT_KEYS_BY_CHANNEL_AND_TYPE: Record<DeviceChannel, Record<DeviceType, DeviceLimitKey>> = {
  web: {
    mobile: "webMobile",
    desktop: "webDesktop",
    tablet: "webTablet",
  },
  miniProgram: {
    mobile: "miniMobile",
    desktop: "miniDesktop",
    tablet: "miniTablet",
  },
};

export function deviceLimitKey(channel: DeviceChannel, deviceType: DeviceType): DeviceLimitKey {
  return LIMIT_KEYS_BY_CHANNEL_AND_TYPE[channel][deviceType];
}

export function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  const normalized = userAgent ?? "";
  const isTablet =
    /iPad|Tablet/i.test(normalized) ||
    (/Macintosh/i.test(normalized) && /Mobile/i.test(normalized)) ||
    (/Android/i.test(normalized) && !/Mobile/i.test(normalized));

  if (isTablet) return "tablet";
  if (/Mobile|iPhone|iPod|Android/i.test(normalized)) return "mobile";
  return "desktop";
}

function isValidLimit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 20;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDeviceLimits(value: unknown): value is DeviceLimits {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === DEVICE_LIMIT_KEYS.length &&
    keys.every((key) => DEVICE_LIMIT_KEY_SET.has(key)) &&
    DEVICE_LIMIT_KEYS.every((key) => isValidLimit(value[key]))
  );
}

export function validateDeviceLimitOverrides(value: unknown): value is DeviceLimitOverrides {
  if (!isObject(value)) return false;
  return (
    Object.keys(value).every((key) => DEVICE_LIMIT_KEY_SET.has(key)) &&
    DEVICE_LIMIT_KEYS.every((key) => value[key] == null || isValidLimit(value[key]))
  );
}

export function effectiveDeviceLimits(
  globalLimits: DeviceLimits,
  overrides: DeviceLimitOverrides | null | undefined,
): DeviceLimits {
  const effective = { ...globalLimits };
  if (!overrides) return effective;

  for (const key of DEVICE_LIMIT_KEYS) {
    const override = overrides[key];
    if (override != null) effective[key] = override;
  }
  return effective;
}

export function cleanLimitedText(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string" || maxLength < 1) return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
