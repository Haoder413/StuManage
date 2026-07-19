import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth";
import {
  DEFAULT_DEVICE_LIMITS,
  DeviceChannel,
  DeviceLimitKey,
  DeviceLimitOverrides,
  DeviceLimits,
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

export type DeviceSessionDevice = {
  id: string;
  userId: string;
  channel: string;
  deviceType: string;
  deviceKeyHash: string;
};

export type DeviceSessionTransaction = {
  deleteExpiredSessions(now: Date): Promise<void>;
  upsertDefaultPolicy(): Promise<DeviceLimits>;
  findUserOverride(userId: string): Promise<DeviceLimitOverrides | null>;
  upsertDevice(input: {
    userId: string;
    channel: DeviceChannel;
    deviceType: DeviceType;
    deviceKeyHash: string;
    displayName: string;
    browser: string | null;
    operatingSystem: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    now: Date;
  }): Promise<DeviceSessionDevice>;
  deleteDeviceSessions(input: { userId: string; channel: DeviceChannel; deviceId: string }): Promise<void>;
  findActiveDeviceIds(input: {
    userId: string;
    channel: DeviceChannel;
    deviceType: DeviceType;
    currentDeviceId: string;
    now: Date;
  }): Promise<string[]>;
  createSession(input: {
    userId: string;
    deviceId: string;
    channel: DeviceChannel;
    tokenHash: string;
    expiresAt: Date;
    lastSeenAt: Date;
  }): Promise<void>;
  upsertPrivacyConsent(input: {
    userId: string;
    channel: DeviceChannel;
    version: string;
    acceptedAt: Date;
  }): Promise<void>;
};

export type DeviceSessionDatabase = {
  transaction<T>(work: (transaction: DeviceSessionTransaction) => Promise<T>): Promise<T>;
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
    !/^[0-9a-f]{64}$/.test(input.deviceKey) ||
    new Set(input.deviceKey).size < 8 ||
    hasRepeatedPattern(input.deviceKey)
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

function hasRepeatedPattern(value: string): boolean {
  for (let length = 1; length <= value.length / 2; length += 1) {
    if (value.length % length === 0 && value.slice(0, length).repeat(value.length / length) === value) {
      return true;
    }
  }
  return false;
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

const prismaDeviceSessionDatabase: DeviceSessionDatabase = {
  transaction(work) {
    return prisma.$transaction(async (transaction) =>
      work({
        async deleteExpiredSessions(now) {
          await transaction.session.deleteMany({ where: { expiresAt: { lte: now } } });
        },
        async upsertDefaultPolicy() {
          return transaction.deviceLoginPolicy.upsert({
            where: { id: "default" },
            create: { id: "default", ...DEFAULT_DEVICE_LIMITS },
            update: {},
          });
        },
        async findUserOverride(userId) {
          return transaction.userDeviceLimitOverride.findUnique({ where: { userId } });
        },
        async upsertDevice(input) {
          return transaction.loginDevice.upsert({
            where: {
              userId_channel_deviceKeyHash: {
                userId: input.userId,
                channel: input.channel,
                deviceKeyHash: input.deviceKeyHash,
              },
            },
            create: {
              userId: input.userId,
              channel: input.channel,
              deviceType: input.deviceType,
              deviceKeyHash: input.deviceKeyHash,
              displayName: input.displayName,
              browser: input.browser,
              operatingSystem: input.operatingSystem,
              userAgent: input.userAgent,
              lastIpAddress: input.ipAddress,
              firstSeenAt: input.now,
              lastLoginAt: input.now,
              lastSeenAt: input.now,
            },
            update: {
              deviceType: input.deviceType,
              displayName: input.displayName,
              browser: input.browser,
              operatingSystem: input.operatingSystem,
              userAgent: input.userAgent,
              lastIpAddress: input.ipAddress,
              lastLoginAt: input.now,
              lastSeenAt: input.now,
              lastLogoutAt: null,
            },
          });
        },
        async deleteDeviceSessions(input) {
          await transaction.session.deleteMany({
            where: { userId: input.userId, channel: input.channel, deviceId: input.deviceId },
          });
        },
        async findActiveDeviceIds(input) {
          const devices = await transaction.loginDevice.findMany({
            where: {
              userId: input.userId,
              channel: input.channel,
              deviceType: input.deviceType,
              id: { not: input.currentDeviceId },
              sessions: { some: { expiresAt: { gt: input.now } } },
            },
            select: { id: true },
          });
          return devices.map((device) => device.id);
        },
        async createSession(input) {
          await transaction.session.create({ data: input });
        },
        async upsertPrivacyConsent(input) {
          await transaction.privacyConsent.upsert({
            where: {
              userId_channel_version: {
                userId: input.userId,
                channel: input.channel,
                version: input.version,
              },
            },
            create: input,
            update: { acceptedAt: input.acceptedAt },
          });
        },
      }),
    );
  },
};

export async function createDeviceSession(
  userId: string,
  rawInput: CreateDeviceSessionInput,
  database: DeviceSessionDatabase = prismaDeviceSessionDatabase,
) {
  const input = normalizeDeviceSessionInput(rawInput);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const deviceKeyHash = hashToken(input.deviceKey);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  const userAgentDescription = describeUserAgent(input.userAgent);
  const displayName = input.displayName ?? userAgentDescription.displayName;

  await database.transaction(async (transaction) => {
    await transaction.deleteExpiredSessions(now);

    const policy = await transaction.upsertDefaultPolicy();
    const override = await transaction.findUserOverride(userId);
    const limits = effectiveDeviceLimits(policy, override);
    const limitKey = deviceLimitKey(input.channel, input.deviceType);
    const limit = limits[limitKey];

    const device = await transaction.upsertDevice({
      userId,
      channel: input.channel,
      deviceType: input.deviceType,
      deviceKeyHash,
      displayName,
      browser: userAgentDescription.browser,
      operatingSystem: userAgentDescription.operatingSystem,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      now,
    });

    assertDeviceSessionScope(device, { userId, channel: input.channel });

    await transaction.deleteDeviceSessions({ userId, channel: input.channel, deviceId: device.id });

    const activeOtherDeviceIds = await transaction.findActiveDeviceIds({
      userId,
      channel: input.channel,
      deviceType: input.deviceType,
      currentDeviceId: device.id,
      now,
    });
    if (
      !hasDeviceCapacity({
        activeDeviceIds: activeOtherDeviceIds,
        currentDeviceId: device.id,
        limit,
      })
    ) {
      throw new DeviceLimitError(limit, limitKey);
    }

    await transaction.createSession({
      userId,
      deviceId: device.id,
      channel: input.channel,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
    });
    await transaction.upsertPrivacyConsent({
      userId,
      channel: input.channel,
      version: PRIVACY_VERSION,
      acceptedAt: now,
    });
  });

  return { token, expiresAt };
}
