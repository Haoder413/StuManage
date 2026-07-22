import {
  DEVICE_LIMIT_KEYS,
  type DeviceLimitKey,
  type DeviceLimits,
} from "@/lib/device-session-policy";

export type CompleteDeviceLimitOverride = Record<DeviceLimitKey, number | null>;

export class DeviceAdminInputError extends Error {
  constructor(readonly code: "invalid_device_policy" | "invalid_device_override") {
    super(code);
    this.name = "DeviceAdminInputError";
  }
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === DEVICE_LIMIT_KEYS.length && DEVICE_LIMIT_KEYS.every((key) => keys.includes(key));
}

function validLimit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 20;
}

export function parseDevicePolicyInput(value: unknown): DeviceLimits {
  if (!isPlainObject(value) || !hasExactKeys(value) || !DEVICE_LIMIT_KEYS.every((key) => validLimit(value[key]))) {
    throw new DeviceAdminInputError("invalid_device_policy");
  }
  return Object.fromEntries(DEVICE_LIMIT_KEYS.map((key) => [key, value[key]])) as DeviceLimits;
}

export function parseDeviceLimitOverrideInput(value: unknown): CompleteDeviceLimitOverride {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value) ||
    !DEVICE_LIMIT_KEYS.every((key) => value[key] === null || validLimit(value[key]))
  ) {
    throw new DeviceAdminInputError("invalid_device_override");
  }
  return Object.fromEntries(DEVICE_LIMIT_KEYS.map((key) => [key, value[key]])) as CompleteDeviceLimitOverride;
}

export function isEmptyDeviceLimitOverride(value: CompleteDeviceLimitOverride): boolean {
  return DEVICE_LIMIT_KEYS.every((key) => value[key] === null);
}
