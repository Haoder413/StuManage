import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  CreateDeviceSessionInput,
  DeviceSessionDatabase,
  DeviceSessionTransaction,
  SessionLifecycleDatabase,
  DeviceLimitError,
  cleanupOldDeviceHistory,
  createDeviceSession,
  createPrismaDeviceSessionDatabase,
  createPrismaSessionLifecycleDatabase,
  describeUserAgent,
  deviceHistoryCutoff,
  deviceLimitMessage,
  getRequestIp,
  hasDeviceCapacity,
  normalizeDeviceSessionInput,
  logoutDeviceSession,
  shouldTouchSession,
  touchSessionActivity,
} from "./device-session";

test("requires explicit privacy consent", () => {
  assert.throws(
    () => normalizeDeviceSessionInput({ channel: "web", deviceKey: "a".repeat(32), privacyAccepted: false }),
    /隐私|同意/,
  );
  assert.throws(
    () => normalizeDeviceSessionInput({ channel: "web", deviceKey: "a".repeat(32), privacyAccepted: 1 as never }),
    /隐私|同意/,
  );
});

test("accepts only reasonably sized control-free high-entropy device keys", () => {
  const generated = randomBytes(32).toString("hex");
  assert.equal(normalizeDeviceSessionInput({ channel: "web", deviceKey: generated, privacyAccepted: true }).deviceKey, generated);
  for (const deviceKey of [
    "a".repeat(64),
    "0123456789abcdef".repeat(4),
    generated.toUpperCase(),
    "a".repeat(63),
    `${"a".repeat(63)}\n`,
  ]) {
    assert.throws(
      () => normalizeDeviceSessionInput({ channel: "web", deviceKey, privacyAccepted: true }),
      /设备标识/,
    );
  }
});

test("web device type comes from user agent and metadata is cleaned and limited", () => {
  const input = normalizeDeviceSessionInput({
    channel: "web",
    deviceKey: createHash("sha256").update("metadata-device").digest("hex"),
    deviceType: "mobile",
    displayName: `  My\nBrowser ${"x".repeat(140)}`,
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 ${"u".repeat(600)}`,
    ipAddress: `  203.0.113.7\n${"9".repeat(80)}`,
    privacyAccepted: true,
  });

  assert.equal(input.deviceType, "desktop");
  assert.equal(input.displayName?.includes("\n"), false);
  assert.equal(input.displayName?.length, 120);
  assert.equal(input.userAgent?.length, 500);
  assert.equal(input.ipAddress?.length, 64);
});

test("uses the effective override key for capacity and formats a stable limit error", () => {
  assert.equal(
    hasDeviceCapacity({ activeDeviceIds: ["device-a", "device-b", "device-b"], currentDeviceId: "device-b", limit: 2 }),
    true,
  );
  assert.equal(
    hasDeviceCapacity({ activeDeviceIds: ["device-a", "device-b"], currentDeviceId: "device-c", limit: 2 }),
    false,
  );
  assert.equal(deviceLimitMessage(2), "该账号此类设备已达到 2 台，请联系管理员或先退出其他设备");
  const error = new DeviceLimitError(2, "webDesktop");
  assert.equal(error.code, "DEVICE_LIMIT_REACHED");
  assert.equal(error.limitKey, "webDesktop");
  assert.equal(error.message, deviceLimitMessage(2));
});

test("recognizes common browser and operating system details without external packages", () => {
  assert.deepEqual(
    describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"),
    { browser: "Chrome", operatingSystem: "Windows", displayName: "Chrome · Windows" },
  );
  assert.deepEqual(
    describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit Mobile Safari/604.1"),
    { browser: "Safari", operatingSystem: "iOS", displayName: "Safari · iOS" },
  );
});

test("uses only a valid x-real-ip when proxy trust is explicitly enabled", () => {
  const values: Record<string, string> = {
    "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    "x-real-ip": "198.51.100.1",
  };
  const headers = { get: (name: string) => values[name] ?? null };
  assert.equal(getRequestIp(headers, false), null);
  assert.equal(getRequestIp(headers, true), "198.51.100.1");
  assert.equal(getRequestIp(new Headers({ "x-forwarded-for": "203.0.113.8" }), true), null);
  assert.equal(getRequestIp(new Headers({ "x-real-ip": "not-an-ip" }), true), null);
  assert.equal(getRequestIp(new Headers({ "x-real-ip": "2001:db8::1" }), true), "2001:db8::1");
});

test("throttles activity touches to five minutes and computes a 90-day cutoff", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  assert.equal(shouldTouchSession(new Date("2026-07-19T11:56:00.001Z"), now), false);
  assert.equal(shouldTouchSession(new Date("2026-07-19T11:55:00.000Z"), now), true);
  assert.equal(shouldTouchSession(null, now), true);
  assert.equal(deviceHistoryCutoff(now).toISOString(), "2026-04-20T12:00:00.000Z");
});

test("transaction source uses the scope guard, effective keyed limit, and device relation", () => {
  const source = readFileSync(new URL("./device-session.ts", import.meta.url), "utf8");
  assert.match(source, /\$transaction\s*\(\s*async/);
  assert.match(source, /assertDeviceSessionScope\s*\(/);
  assert.match(source, /deviceLimitKey\s*\(/);
  assert.match(source, /effectiveDeviceLimits\s*\(/);
  assert.match(source, /deviceId:\s*device\.id/);
  assert.match(source, /privacyConsent\.upsert/);
  assert.doesNotMatch(source, /export\s+async\s+function\s+create\w*Session\([^)]*deviceId/);
});

type FakeDevice = {
  id: string;
  userId: string;
  channel: string;
  deviceType: string;
  deviceKeyHash: string;
  lastSeenAt?: Date;
};

type FakeSession = {
  id: string;
  userId: string;
  deviceId: string;
  channel: string;
  tokenHash: string;
  expiresAt: Date;
};

type FakeState = {
  devices: FakeDevice[];
  sessions: FakeSession[];
  consents: Array<{ userId: string; channel: string; version: string }>;
  overrides: Record<string, { webDesktop?: number }>;
  cleanupCutoffs?: Date[];
};

function copyState(state: FakeState): FakeState {
  return {
    devices: state.devices.map((item) => ({ ...item })),
    sessions: state.sessions.map((item) => ({ ...item, expiresAt: new Date(item.expiresAt) })),
    consents: state.consents.map((item) => ({ ...item })),
    overrides: Object.fromEntries(Object.entries(state.overrides).map(([key, value]) => [key, { ...value }])),
    cleanupCutoffs: state.cleanupCutoffs?.map((date) => new Date(date)),
  };
}

function deviceKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

class FakeDeviceSessionDatabase implements DeviceSessionDatabase {
  constructor(public state: FakeState) {}

  async transaction<T>(work: (transaction: DeviceSessionTransaction) => Promise<T>): Promise<T> {
    const draft = copyState(this.state);
    const transaction: DeviceSessionTransaction = {
      async deleteExpiredSessions(now: Date) {
        draft.sessions = draft.sessions.filter((session) => session.expiresAt > now);
      },
      async upsertDefaultPolicy() {
        return { webMobile: 2, webDesktop: 2, webTablet: 2, miniMobile: 2, miniDesktop: 2, miniTablet: 2 };
      },
      async findUserOverride(userId: string) {
        return draft.overrides[userId] ?? null;
      },
      async upsertDevice(input) {
        const existing = draft.devices.find(
          (device) => device.userId === input.userId && device.channel === input.channel && device.deviceKeyHash === input.deviceKeyHash,
        );
        if (existing) {
          existing.deviceType = input.deviceType;
          return { ...existing };
        }
        const created = { ...input, id: `device-${draft.devices.length + 1}` };
        draft.devices.push(created);
        return { ...created };
      },
      async deleteDeviceSessions(input) {
        draft.sessions = draft.sessions.filter(
          (session) =>
            !(
              session.userId === input.userId &&
              session.channel === input.channel &&
              session.deviceId === input.deviceId
            ),
        );
      },
      async findActiveDeviceIds(input) {
        return draft.devices
          .filter(
            (device) =>
              device.userId === input.userId &&
              device.channel === input.channel &&
              device.deviceType === input.deviceType &&
              device.id !== input.currentDeviceId &&
              draft.sessions.some((session) => session.deviceId === device.id && session.expiresAt > input.now),
          )
          .map((device) => device.id);
      },
      async createSession(input) {
        draft.sessions.push({ ...input, id: `session-${draft.sessions.length + 1}` });
      },
      async upsertPrivacyConsent(input) {
        if (!draft.consents.some((consent) => consent.userId === input.userId && consent.channel === input.channel && consent.version === input.version)) {
          draft.consents.push({ userId: input.userId, channel: input.channel, version: input.version });
        }
      },
    };

    const result = await work(transaction);
    this.state = draft;
    return result;
  }

  async deleteOldInactiveDevices(cutoff: Date): Promise<number> {
    this.state.cleanupCutoffs = [...(this.state.cleanupCutoffs ?? []), cutoff];
    const previousCount = this.state.devices.length;
    this.state.devices = this.state.devices.filter(
      (device) =>
        this.state.sessions.some((session) => session.deviceId === device.id) ||
        !device.lastSeenAt ||
        device.lastSeenAt >= cutoff,
    );
    return previousCount - this.state.devices.length;
  }
}

const baseInput = (key: string): CreateDeviceSessionInput => ({
  channel: "web",
  deviceKey: key,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
  privacyAccepted: true,
});

test("executes successful session, consent, and expired-session cleanup through the transaction dependency", async () => {
  const db = new FakeDeviceSessionDatabase({
    devices: [],
    sessions: [{ id: "expired", userId: "u", deviceId: "old", channel: "web", tokenHash: "old", expiresAt: new Date(0) }],
    consents: [],
    overrides: {},
  });

  await createDeviceSession("u", baseInput(deviceKey("one")), db);

  assert.equal(db.state.sessions.length, 1);
  assert.equal(db.state.devices.length, 1);
  assert.notEqual(db.state.devices[0].deviceKeyHash, deviceKey("one"));
  assert.deepEqual(db.state.consents, [{ userId: "u", channel: "web", version: "2026-07-19" }]);
  assert.equal(db.state.cleanupCutoffs?.length, 1);
});

test("cleans only inactive device history older than 90 days", async () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  const db = new FakeDeviceSessionDatabase({
    devices: [
      { id: "old-unused", userId: "u", channel: "web", deviceType: "desktop", deviceKeyHash: "1", lastSeenAt: new Date("2026-04-19") },
      { id: "old-active", userId: "u", channel: "web", deviceType: "desktop", deviceKeyHash: "2", lastSeenAt: new Date("2026-04-19") },
      { id: "recent", userId: "u", channel: "web", deviceType: "desktop", deviceKeyHash: "3", lastSeenAt: new Date("2026-07-18") },
    ],
    sessions: [{ id: "s", userId: "u", deviceId: "old-active", channel: "web", tokenHash: "h", expiresAt: new Date("2026-08-01") }],
    consents: [],
    overrides: {},
  });
  await cleanupOldDeviceHistory(db, now);
  assert.deepEqual(db.state.devices.map((device) => device.id), ["old-active", "recent"]);
});

test("touches stale session/device activity and logs out device in one injected operation", async () => {
  const calls: string[] = [];
  const lifecycle: SessionLifecycleDatabase = {
    async touchSessionAndDevice(input) {
      calls.push(`touch:${input.sessionId}:${input.deviceId}`);
    },
    async logoutSessionAndDevice(input) {
      calls.push(`logout:${input.tokenHash.length}:${input.now.toISOString()}`);
    },
  };
  const now = new Date("2026-07-19T12:00:00.000Z");
  await touchSessionActivity({ id: "session", deviceId: "device", lastSeenAt: new Date("2026-07-19T11:00:00Z") }, now, lifecycle);
  await touchSessionActivity({ id: "fresh", deviceId: "device", lastSeenAt: new Date("2026-07-19T11:59:00Z") }, now, lifecycle);
  await logoutDeviceSession("a".repeat(64), now, lifecycle);
  assert.deepEqual(calls, ["touch:session:device", `logout:64:${now.toISOString()}`]);
});

test("activity update failure does not reject authentication flow", async () => {
  const lifecycle: SessionLifecycleDatabase = {
    async touchSessionAndDevice() {
      throw new Error("database unavailable");
    },
    async logoutSessionAndDevice() {},
  };
  const touched = await touchSessionActivity(
    { id: "session", deviceId: "device", lastSeenAt: new Date(0) },
    new Date("2026-07-19T12:00:00Z"),
    lifecycle,
    () => {},
  );
  assert.equal(touched, false);
});

test("Prisma lifecycle adapter touches activity and updates device logout before deleting the session", async () => {
  const calls: string[] = [];
  const tx = {
    session: {
      findUnique: async () => ({ id: "session", deviceId: "device" }),
      delete: async () => { calls.push("delete-session"); return {}; },
      updateMany: async () => { calls.push("touch-session"); return { count: 1 }; },
    },
    loginDevice: {
      updateMany: async (args: { data: { lastSeenAt?: Date; lastLogoutAt?: Date } }) => {
        calls.push(args.data.lastSeenAt ? "touch-device" : "update-device-logout");
        return { count: 1 };
      },
    },
  };
  const db = createPrismaSessionLifecycleDatabase({
    $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
  } as never);
  const now = new Date("2026-07-19T12:00:00Z");
  await touchSessionActivity({ id: "session", deviceId: "device", lastSeenAt: new Date(0) }, now, db);
  await logoutDeviceSession("a".repeat(64), now, db);
  assert.deepEqual(calls, ["touch-session", "touch-device", "update-device-logout", "delete-session"]);
});

test("Prisma adapter emits scoped cleanup and active-device query shapes", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const tx = {
    session: {
      deleteMany: async (args: unknown) => { calls.push({ name: "session.deleteMany", args }); return { count: 0 }; },
      create: async (args: unknown) => { calls.push({ name: "session.create", args }); return {}; },
    },
    deviceLoginPolicy: { upsert: async () => ({ webMobile: 2, webDesktop: 2, webTablet: 2, miniMobile: 2, miniDesktop: 2, miniTablet: 2 }) },
    userDeviceLimitOverride: { findUnique: async () => null },
    loginDevice: {
      upsert: async () => ({ id: "d", userId: "u", channel: "web", deviceType: "desktop", deviceKeyHash: "h" }),
      findMany: async (args: unknown) => { calls.push({ name: "loginDevice.findMany", args }); return [{ id: "other" }]; },
      deleteMany: async (args: unknown) => { calls.push({ name: "loginDevice.deleteMany", args }); return { count: 1 }; },
    },
    privacyConsent: { upsert: async () => ({}) },
  };
  const client = {
    $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx),
    loginDevice: tx.loginDevice,
  };
  const db = createPrismaDeviceSessionDatabase(client as never);
  const now = new Date("2026-07-19T12:00:00Z");
  await db.transaction(async (transaction) => {
    await transaction.findActiveDeviceIds({ userId: "u", channel: "web", deviceType: "desktop", currentDeviceId: "d", now });
  });
  await db.deleteOldInactiveDevices(deviceHistoryCutoff(now));
  assert.deepEqual(calls.find((call) => call.name === "loginDevice.findMany")?.args, {
    where: { userId: "u", channel: "web", deviceType: "desktop", id: { not: "d" }, sessions: { some: { expiresAt: { gt: now } } } },
    select: { id: true },
  });
  assert.deepEqual(calls.find((call) => call.name === "loginDevice.deleteMany")?.args, {
    where: { sessions: { none: {} }, lastSeenAt: { lt: deviceHistoryCutoff(now) } },
  });
});

test("relogin on the same device replaces its session without consuming another slot", async () => {
  const db = new FakeDeviceSessionDatabase({ devices: [], sessions: [], consents: [], overrides: {} });
  await createDeviceSession("u", baseInput(deviceKey("same")), db);
  await createDeviceSession("u", baseInput(deviceKey("same")), db);
  assert.equal(db.state.devices.length, 1);
  assert.equal(db.state.sessions.length, 1);
});

test("third distinct device rolls back device, session cleanup, and consent side effects", async () => {
  const db = new FakeDeviceSessionDatabase({ devices: [], sessions: [], consents: [], overrides: {} });
  await createDeviceSession("u", baseInput(deviceKey("first")), db);
  await createDeviceSession("u", baseInput(deviceKey("second")), db);
  const before = copyState(db.state);

  await assert.rejects(() => createDeviceSession("u", baseInput(deviceKey("third")), db), DeviceLimitError);
  assert.deepEqual(db.state, before);
  assert.equal(new Set(db.state.sessions.map((session) => session.deviceId)).size, 2);
});

test("counts distinct devices despite duplicate sessions and applies a user override", async () => {
  const db = new FakeDeviceSessionDatabase({ devices: [], sessions: [], consents: [], overrides: { u: { webDesktop: 3 } } });
  await createDeviceSession("u", baseInput(deviceKey("first")), db);
  db.state.sessions.push({ ...db.state.sessions[0], id: "duplicate", tokenHash: "duplicate" });
  await createDeviceSession("u", baseInput(deviceKey("second")), db);
  await createDeviceSession("u", baseInput(deviceKey("third")), db);
  assert.equal(db.state.devices.length, 3);
});
