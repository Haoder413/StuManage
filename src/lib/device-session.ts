import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth";
import {
  DEFAULT_DEVICE_LIMITS,
  DeviceChannel,
  DeviceLimitKey,
  DeviceType,
  assertDeviceSessionScope,
  cleanLimitedText,
  detectDeviceType,
  deviceLimitKey,
  effectiveDeviceLimits,
} from "@/lib/device-session-policy";
import { prisma } from "@/lib/prisma";

export const PRIVACY_VERSION = "2026-07-19";
export const SESSION_DAYS = 14;

export type CreateDeviceSessionInput = {
  channel: DeviceChannel;
  deviceKey: string;
  deviceType?: DeviceType;
  displayName?: string;
  userAgent?: string;
  ipAddress?: string;
  privacyAccepted: boolean;
};

type NormalizedDeviceSessionInput = {
  channel: DeviceChannel;
  deviceKey: string;
  deviceType: DeviceType;
  displayName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
};

export class DeviceSessionValidationError extends Error {
  readonly code = "INVALID_DEVICE_SESSION_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "DeviceSessionValidationError";
  }
}

export function deviceLimitMessage(limit: number): string {
  return `该账号此类设备已达到 ${limit} 台，请联系管理员或先退出其他设备`;
}

export class DeviceLimitError extends Error {
  readonly code = "DEVICE_LIMIT_REACHED";

  constructor(
    readonly limit: number,
    readonly limitKey: DeviceLimitKey,
  ) {
    super(deviceLimitMessage(limit));
    this.name = "DeviceLimitError";
  }
}

function normalizeChannel(value: unknown): DeviceChannel {
  if (value === "web" || value === "miniProgram") return value;
  throw new DeviceSessionValidationError("登录渠道无效");
}

function normalizeDeviceType(value: unknown): DeviceType {
  if (value === "mobile" || value === "desktop" || value === "tablet") return value;
  throw new DeviceSessionValidationError("设备类型无效");
}

export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string | null;
  operatingSystem: string | null;
  displayName: string;
} {
  const value = userAgent ?? "";
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /(?:Chrome|CriOS)\//i.test(value)
      ? "Chrome"
      : /Firefox|FxiOS/i.test(value)
        ? "Firefox"
        : /Safari\//i.test(value) && !/(?:Chrome|CriOS|Edg)\//i.test(value)
          ? "Safari"
          : null;
  const operatingSystem = /Windows/i.test(value)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(value)
      ? "iOS"
      : /Android/i.test(value)
        ? "Android"
        : /Macintosh|Mac OS X/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : null;
  const displayName = [browser, operatingSystem].filter(Boolean).join(" · ") || "未知设备";
  return { browser, operatingSystem, displayName };
}

export function normalizeDeviceSessionInput(input: CreateDeviceSessionInput): NormalizedDeviceSessionInput {
  if (input.privacyAccepted !== true) {
    throw new DeviceSessionValidationError("请先阅读并同意隐私说明");
  }
  if (
    typeof input.deviceKey !== "string" ||
    input.deviceKey.length < 32 ||
    input.deviceKey.length > 200 ||
    /[\u0000-\u001F\u007F]/.test(input.deviceKey)
  ) {
    throw new DeviceSessionValidationError("设备标识无效");
  }

  const channel = normalizeChannel(input.channel);
  const userAgent = cleanLimitedText(input.userAgent, 500);
  const deviceType = channel === "web" ? detectDeviceType(userAgent) : normalizeDeviceType(input.deviceType);

  return {
    channel,
    deviceKey: input.deviceKey,
    deviceType,
    displayName: cleanLimitedText(input.displayName, 120),
    userAgent,
    ipAddress: cleanLimitedText(input.ipAddress, 64),
  };
}

export function hasDeviceCapacity(input: {
  activeDeviceIds: readonly string[];
  currentDeviceId: string;
  limit: number;
}): boolean {
  const activeOtherDeviceIds = new Set(input.activeDeviceIds.filter((id) => id !== input.currentDeviceId));
  return activeOtherDeviceIds.size < input.limit;
}

export function getRequestIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",", 1)[0];
  return cleanLimitedText(firstForwarded ?? headers.get("x-real-ip"), 64);
}

export async function createDeviceSession(userId: string, rawInput: CreateDeviceSessionInput) {
  const input = normalizeDeviceSessionInput(rawInput);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const deviceKeyHash = hashToken(input.deviceKey);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  const userAgentDescription = describeUserAgent(input.userAgent);
  const displayName = input.displayName ?? userAgentDescription.displayName;

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.session.deleteMany({ where: { expiresAt: { lte: now } } });

    const policy = await transaction.deviceLoginPolicy.upsert({
      where: { id: "default" },
      create: { id: "default", ...DEFAULT_DEVICE_LIMITS },
      update: {},
    });
    const override = await transaction.userDeviceLimitOverride.findUnique({ where: { userId } });
    const limits = effectiveDeviceLimits(policy, override);
    const limitKey = deviceLimitKey(input.channel, input.deviceType);
    const limit = limits[limitKey];

    const device = await transaction.loginDevice.upsert({
      where: {
        userId_channel_deviceKeyHash: {
          userId,
          channel: input.channel,
          deviceKeyHash,
        },
      },
      create: {
        userId,
        channel: input.channel,
        deviceType: input.deviceType,
        deviceKeyHash,
        displayName,
        browser: userAgentDescription.browser,
        operatingSystem: userAgentDescription.operatingSystem,
        userAgent: input.userAgent,
        lastIpAddress: input.ipAddress,
        firstSeenAt: now,
        lastLoginAt: now,
        lastSeenAt: now,
      },
      update: {
        deviceType: input.deviceType,
        displayName,
        browser: userAgentDescription.browser,
        operatingSystem: userAgentDescription.operatingSystem,
        userAgent: input.userAgent,
        lastIpAddress: input.ipAddress,
        lastLoginAt: now,
        lastSeenAt: now,
        lastLogoutAt: null,
      },
    });

    assertDeviceSessionScope(device, { userId, channel: input.channel });

    await transaction.session.deleteMany({
      where: { userId, channel: input.channel, deviceId: device.id },
    });

    const activeOtherDevices = await transaction.loginDevice.findMany({
      where: {
        userId,
        channel: input.channel,
        deviceType: input.deviceType,
        id: { not: device.id },
        sessions: { some: { expiresAt: { gt: now } } },
      },
      select: { id: true },
    });
    if (
      !hasDeviceCapacity({
        activeDeviceIds: activeOtherDevices.map((activeDevice) => activeDevice.id),
        currentDeviceId: device.id,
        limit,
      })
    ) {
      throw new DeviceLimitError(limit, limitKey);
    }

    await transaction.session.create({
      data: {
        userId,
        deviceId: device.id,
        channel: input.channel,
        tokenHash,
        expiresAt,
        lastSeenAt: now,
      },
    });
    await transaction.privacyConsent.upsert({
      where: { userId_channel_version: { userId, channel: input.channel, version: PRIVACY_VERSION } },
      create: { userId, channel: input.channel, version: PRIVACY_VERSION, acceptedAt: now },
      update: { acceptedAt: now },
    });

  });

  return { token, expiresAt };
}
