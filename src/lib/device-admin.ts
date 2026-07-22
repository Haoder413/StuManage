import {
  DEFAULT_DEVICE_LIMITS,
  DEVICE_LIMIT_KEYS,
  effectiveDeviceLimits,
  type DeviceLimitOverrides,
  type DeviceLimits,
} from "@/lib/device-session-policy";
import {
  isEmptyDeviceLimitOverride,
  type CompleteDeviceLimitOverride,
} from "@/lib/device-admin-input";
import { cleanupOldDeviceHistory, deviceHistoryCutoff } from "@/lib/device-session";
import { prisma } from "@/lib/prisma";

export type DeviceAdminActor = { id: string; name: string };
export type DeviceAdminUser = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
};
export type AdminDeviceView = {
  id: string;
  channel: string;
  deviceType: string;
  displayName: string;
  browser: string | null;
  operatingSystem: string | null;
  lastIpAddress: string | null;
  firstSeenAt: Date;
  lastLoginAt: Date;
  lastSeenAt: Date;
  lastLogoutAt: Date | null;
  activeSessionCount: number;
};
export type DeviceAuditInput = {
  adminId: string | null;
  targetUserId: string | null;
  actorUserIdSnapshot: string;
  actorNameSnapshot: string;
  targetUserIdSnapshot: string | null;
  targetNameSnapshot: string | null;
  action: string;
  summary: string | null;
};

export type DeviceAdminTransaction = {
  findPolicy(): Promise<DeviceLimits | null>;
  upsertPolicy(value: DeviceLimits): Promise<DeviceLimits>;
  findUser(id: string): Promise<DeviceAdminUser | null>;
  findOverride(userId: string): Promise<DeviceLimitOverrides | null>;
  upsertOverride(userId: string, value: CompleteDeviceLimitOverride): Promise<DeviceLimitOverrides>;
  deleteOverride(userId: string): Promise<void>;
  findDevice(userId: string, deviceId: string): Promise<{
    id: string;
    userId: string;
    displayName: string;
    channel: string;
    deviceType: string;
  } | null>;
  findSessionDeviceIds(userId: string): Promise<string[]>;
  deleteSessions(where: { userId: string; deviceId?: string; channel?: string }): Promise<number>;
  markDevicesLoggedOut(where: { userId: string; deviceIds: string[]; at: Date }): Promise<void>;
  createAudit(data: DeviceAuditInput): Promise<void>;
};

export type DeviceAdminDatabase = {
  cleanupOldDeviceHistory(): Promise<number>;
  findUser(id: string): Promise<DeviceAdminUser | null>;
  findPolicy(): Promise<DeviceLimits | null>;
  upsertDefaultPolicy(): Promise<DeviceLimits>;
  findOverride(userId: string): Promise<DeviceLimitOverrides | null>;
  findDevices(userId: string, now: Date, cutoff: Date): Promise<AdminDeviceView[]>;
  transaction<T>(work: (transaction: DeviceAdminTransaction) => Promise<T>): Promise<T>;
};

export class DeviceAdminNotFoundError extends Error {
  constructor() {
    super("not_found");
    this.name = "DeviceAdminNotFoundError";
  }
}

function policyFields(value: DeviceLimits | DeviceLimitOverrides | null | undefined): DeviceLimitOverrides {
  return Object.fromEntries(DEVICE_LIMIT_KEYS.map((key) => [key, value?.[key] ?? null]));
}

function completePolicy(value: DeviceLimits | null): DeviceLimits {
  return value ?? { ...DEFAULT_DEVICE_LIMITS };
}

function auditData(
  actor: DeviceAdminActor,
  action: string,
  summary: Record<string, unknown>,
  target?: DeviceAdminUser,
): DeviceAuditInput {
  return {
    adminId: actor.id,
    targetUserId: target?.id ?? null,
    actorUserIdSnapshot: actor.id,
    actorNameSnapshot: actor.name,
    targetUserIdSnapshot: target?.id ?? null,
    targetNameSnapshot: target?.name ?? null,
    action,
    summary: JSON.stringify(summary),
  };
}

export function createDeviceAdminService(database: DeviceAdminDatabase) {
  return {
    async getPolicy(): Promise<DeviceLimits> {
      return database.findPolicy().then((value) => value ?? database.upsertDefaultPolicy());
    },

    async updatePolicy(actor: DeviceAdminActor, next: DeviceLimits): Promise<DeviceLimits> {
      return database.transaction(async (transaction) => {
        const before = completePolicy(await transaction.findPolicy());
        const updated = await transaction.upsertPolicy(next);
        await transaction.createAudit(auditData(actor, "device_policy_updated", { before, after: updated }));
        return updated;
      });
    },

    async getAccountDevices(userId: string, now = new Date()) {
      await database.cleanupOldDeviceHistory();
      const account = await database.findUser(userId);
      if (!account) throw new DeviceAdminNotFoundError();
      const [globalPolicy, override, devices] = await Promise.all([
        database.findPolicy().then((value) => value ?? database.upsertDefaultPolicy()),
        database.findOverride(userId),
        database.findDevices(userId, now, deviceHistoryCutoff(now)),
      ]);
      return {
        account,
        globalPolicy,
        override: override ? policyFields(override) : null,
        effectivePolicy: effectiveDeviceLimits(globalPolicy, override),
        devices: [...devices].sort(
          (left, right) => right.activeSessionCount - left.activeSessionCount || right.lastSeenAt.getTime() - left.lastSeenAt.getTime(),
        ),
      };
    },

    async updateAccountOverride(
      actor: DeviceAdminActor,
      userId: string,
      next: CompleteDeviceLimitOverride,
    ): Promise<DeviceLimitOverrides | null> {
      return database.transaction(async (transaction) => {
        const target = await transaction.findUser(userId);
        if (!target) throw new DeviceAdminNotFoundError();
        const beforeValue = await transaction.findOverride(userId);
        const before = beforeValue ? policyFields(beforeValue) : null;
        let after: DeviceLimitOverrides | null;
        if (isEmptyDeviceLimitOverride(next)) {
          await transaction.deleteOverride(userId);
          after = null;
        } else {
          after = policyFields(await transaction.upsertOverride(userId, next));
        }
        await transaction.createAudit(auditData(actor, "device_limit_override_updated", { before, after }, target));
        return after;
      });
    },

    async forceLogoutDevice(actor: DeviceAdminActor, userId: string, deviceId: string, now = new Date()) {
      return database.transaction(async (transaction) => {
        const target = await transaction.findUser(userId);
        if (!target) throw new DeviceAdminNotFoundError();
        const device = await transaction.findDevice(userId, deviceId);
        if (!device) throw new DeviceAdminNotFoundError();
        const deletedSessions = await transaction.deleteSessions({ userId, deviceId, channel: device.channel });
        await transaction.markDevicesLoggedOut({ userId, deviceIds: [deviceId], at: now });
        await transaction.createAudit(auditData(actor, "device_forced_logout", {
          deviceId,
          channel: device.channel,
          deviceType: device.deviceType,
          displayName: device.displayName,
          deletedSessions,
        }, target));
        return { success: true as const, deletedSessions };
      });
    },

    async forceLogoutAll(actor: DeviceAdminActor, userId: string, now = new Date()) {
      return database.transaction(async (transaction) => {
        const target = await transaction.findUser(userId);
        if (!target) throw new DeviceAdminNotFoundError();
        const deviceIds = [...new Set(await transaction.findSessionDeviceIds(userId))];
        const deletedSessions = await transaction.deleteSessions({ userId });
        if (deviceIds.length > 0) {
          await transaction.markDevicesLoggedOut({ userId, deviceIds, at: now });
        }
        await transaction.createAudit(auditData(actor, "account_forced_logout", {
          deviceCount: deviceIds.length,
          deletedSessions,
        }, target));
        return { success: true as const, deletedSessions };
      });
    },
  };
}

function selectLimits(value: Record<string, unknown>): DeviceLimits {
  return Object.fromEntries(DEVICE_LIMIT_KEYS.map((key) => [key, value[key]])) as DeviceLimits;
}

function selectOverride(value: Record<string, unknown> | null): DeviceLimitOverrides | null {
  return value ? Object.fromEntries(DEVICE_LIMIT_KEYS.map((key) => [key, value[key] ?? null])) : null;
}

const safeUserSelect = { id: true, name: true, phone: true, email: true, role: true } as const;

export function createPrismaDeviceAdminDatabase(client: typeof prisma): DeviceAdminDatabase {
  function transactionAdapter(transaction: Parameters<Parameters<typeof client.$transaction>[0]>[0]): DeviceAdminTransaction {
    return {
      async findPolicy() {
        const value = await transaction.deviceLoginPolicy.findUnique({ where: { id: "default" } });
        return value ? selectLimits(value) : null;
      },
      async upsertPolicy(value) {
        const updated = await transaction.deviceLoginPolicy.upsert({
          where: { id: "default" },
          create: { id: "default", ...value },
          update: value,
        });
        return selectLimits(updated);
      },
      findUser(id) {
        return transaction.user.findUnique({ where: { id }, select: safeUserSelect });
      },
      async findOverride(userId) {
        return selectOverride(await transaction.userDeviceLimitOverride.findUnique({ where: { userId } }));
      },
      async upsertOverride(userId, value) {
        const updated = await transaction.userDeviceLimitOverride.upsert({
          where: { userId },
          create: { userId, ...value },
          update: value,
        });
        return selectOverride(updated) ?? {};
      },
      async deleteOverride(userId) {
        await transaction.userDeviceLimitOverride.deleteMany({ where: { userId } });
      },
      findDevice(userId, deviceId) {
        return transaction.loginDevice.findFirst({
          where: { id: deviceId, userId },
          select: { id: true, userId: true, displayName: true, channel: true, deviceType: true },
        });
      },
      async findSessionDeviceIds(userId) {
        const sessions = await transaction.session.findMany({
          where: { userId, deviceId: { not: null }, device: { userId } },
          select: { deviceId: true },
        });
        return sessions.flatMap((session) => session.deviceId ? [session.deviceId] : []);
      },
      async deleteSessions(where) {
        return (await transaction.session.deleteMany({ where })).count;
      },
      async markDevicesLoggedOut(where) {
        await transaction.loginDevice.updateMany({
          where: { id: { in: where.deviceIds }, userId: where.userId },
          data: { lastLogoutAt: where.at },
        });
      },
      async createAudit(data) {
        await transaction.adminAuditLog.create({ data });
      },
    };
  }

  return {
    cleanupOldDeviceHistory: () => cleanupOldDeviceHistory(undefined),
    findUser(id) {
      return client.user.findUnique({ where: { id }, select: safeUserSelect });
    },
    async findPolicy() {
      const value = await client.deviceLoginPolicy.findUnique({ where: { id: "default" } });
      return value ? selectLimits(value) : null;
    },
    async upsertDefaultPolicy() {
      const value = await client.deviceLoginPolicy.upsert({
        where: { id: "default" },
        create: { id: "default", ...DEFAULT_DEVICE_LIMITS },
        update: {},
      });
      return selectLimits(value);
    },
    async findOverride(userId) {
      return selectOverride(await client.userDeviceLimitOverride.findUnique({ where: { userId } }));
    },
    async findDevices(userId, now, cutoff) {
      const devices = await client.loginDevice.findMany({
        where: { userId, lastSeenAt: { gte: cutoff } },
        select: {
          id: true,
          channel: true,
          deviceType: true,
          displayName: true,
          browser: true,
          operatingSystem: true,
          lastIpAddress: true,
          firstSeenAt: true,
          lastLoginAt: true,
          lastSeenAt: true,
          lastLogoutAt: true,
          sessions: { where: { userId, expiresAt: { gt: now } }, select: { id: true } },
        },
      });
      return devices.map(({ sessions, ...device }) => ({ ...device, activeSessionCount: sessions.length }));
    },
    transaction(work) {
      return client.$transaction((transaction) => work(transactionAdapter(transaction)));
    },
  };
}

export const deviceAdminService = createDeviceAdminService(createPrismaDeviceAdminDatabase(prisma));
