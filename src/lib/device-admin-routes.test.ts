import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DeviceAdminNotFoundError,
  createDeviceAdminService,
  createPrismaDeviceAdminDatabase,
  type DeviceAdminDatabase,
} from "./device-admin";
import { runDeviceAdminRoute } from "./device-admin-route-handler";

const actor = { id: "admin-1", name: "管理员", role: "admin" };
const target = { id: "user-1", name: "王老师", phone: "13800000000", email: null, role: "teacher" };
const policy = {
  webMobile: 2,
  webDesktop: 2,
  webTablet: 2,
  miniMobile: 2,
  miniDesktop: 2,
  miniTablet: 2,
};

function fakeDatabase() {
  const state = {
    policy: null as null | typeof policy,
    override: null as null | Record<string, number | null>,
    audits: [] as Array<Record<string, unknown>>,
    deletedSessionScopes: [] as Array<Record<string, unknown>>,
    deviceUpdates: [] as Array<Record<string, unknown>>,
    cleanupCalls: 0,
  };
  const db: DeviceAdminDatabase = {
    cleanupOldDeviceHistory: async () => { state.cleanupCalls += 1; return 0; },
    findUser: async (id) => id === target.id ? target : null,
    findPolicy: async () => state.policy,
    upsertDefaultPolicy: async () => state.policy ?? policy,
    findOverride: async () => state.override,
    findDevices: async (_userId, now, cutoff) => [{
      id: "device-1", channel: "web", deviceType: "desktop", displayName: "Chrome · macOS",
      browser: "Chrome", operatingSystem: "macOS", lastIpAddress: "203.0.113.4",
      firstSeenAt: cutoff, lastLoginAt: now, lastSeenAt: now, lastLogoutAt: null,
      activeSessionCount: 1,
    }],
    transaction: async (work) => work({
      findPolicy: async () => state.policy,
      upsertPolicy: async (next) => { state.policy = next; return next; },
      findUser: async (id) => id === target.id ? target : null,
      findOverride: async () => state.override,
      upsertOverride: async (_userId, next) => { state.override = next; return next; },
      deleteOverride: async () => { state.override = null; },
      findDevice: async (userId, deviceId) => userId === target.id && deviceId === "device-1"
        ? { id: "device-1", userId, displayName: "Chrome · macOS", channel: "web", deviceType: "desktop" }
        : null,
      findSessionDeviceIds: async (userId) => userId === target.id ? ["device-1", "device-2"] : [],
      deleteSessions: async (where) => { state.deletedSessionScopes.push(where); return 2; },
      markDevicesLoggedOut: async (where) => { state.deviceUpdates.push(where); },
      createAudit: async (data) => { state.audits.push(data); },
    }),
  };
  return { db, state };
}

test("policy update is atomic and writes actor snapshots plus JSON before/after summary", async () => {
  const { db, state } = fakeDatabase();
  const service = createDeviceAdminService(db);
  const next = { ...policy, webMobile: 5 };
  assert.deepEqual(await service.updatePolicy(actor, next), next);
  assert.deepEqual(state.audits[0], {
    adminId: actor.id,
    targetUserId: null,
    actorUserIdSnapshot: actor.id,
    actorNameSnapshot: actor.name,
    targetUserIdSnapshot: null,
    targetNameSnapshot: null,
    action: "device_policy_updated",
    summary: JSON.stringify({ before: policy, after: next }),
  });
});
test("account device list cleans history and returns active-first safe device details", async () => {
  const { db, state } = fakeDatabase();
  const result = await createDeviceAdminService(db).getAccountDevices(target.id, new Date("2026-07-19T12:00:00Z"));
  assert.equal(state.cleanupCalls, 1);
  assert.deepEqual(result.account, target);
  assert.deepEqual(result.globalPolicy, policy);
  assert.equal(result.override, null);
  assert.deepEqual(result.effectivePolicy, policy);
  assert.equal(result.devices[0].activeSessionCount, 1);
  assert.equal("deviceKeyHash" in result.devices[0], false);
  assert.equal("sessions" in result.devices[0], false);
});

test("Prisma account device list counts only active sessions owned by the target user", async () => {
  const now = new Date("2026-07-19T12:00:00Z");
  const cutoff = new Date("2026-04-20T12:00:00Z");
  type DeviceListQuery = {
    where: { userId: string };
    select: { sessions: { where: { userId: string; expiresAt: { gt: Date } } } };
  };
  const client = {
    loginDevice: {
      findMany: async (query: DeviceListQuery) => {
        assert.equal(query.where.userId, target.id);
        assert.equal(query.select.sessions.where.userId, target.id);
        const linkedSessions = [
          { id: "owned-session", userId: target.id, expiresAt: new Date("2026-07-20T00:00:00Z") },
          { id: "crossed-session", userId: "other-user", expiresAt: new Date("2026-07-20T00:00:00Z") },
        ];
        const sessions = linkedSessions.filter((session) =>
          session.userId === query.select.sessions.where.userId &&
          session.expiresAt > query.select.sessions.where.expiresAt.gt,
        );
        return [{
          id: "device-1", channel: "web", deviceType: "desktop", displayName: "Chrome",
          browser: "Chrome", operatingSystem: "macOS", lastIpAddress: null,
          firstSeenAt: cutoff, lastLoginAt: now, lastSeenAt: now, lastLogoutAt: null, sessions,
        }];
      },
    },
  };
  const database = createPrismaDeviceAdminDatabase(
    client as unknown as Parameters<typeof createPrismaDeviceAdminDatabase>[0],
  );
  const devices = await database.findDevices(target.id, now, cutoff);
  assert.equal(devices[0].activeSessionCount, 1);
});

test("clearing all override fields deletes override and audits the change", async () => {
  const { db, state } = fakeDatabase();
  state.override = { ...policy, webMobile: 7 };
  const cleared = Object.fromEntries(Object.keys(policy).map((key) => [key, null])) as Record<keyof typeof policy, null>;
  const result = await createDeviceAdminService(db).updateAccountOverride(actor, target.id, cleared);
  assert.equal(result, null);
  assert.equal(state.override, null);
  assert.equal(state.audits[0].action, "device_limit_override_updated");
  assert.equal(state.audits[0].targetUserIdSnapshot, target.id);
});

test("single-device logout scopes lookup and deletion by target account and device", async () => {
  const { db, state } = fakeDatabase();
  const result = await createDeviceAdminService(db).forceLogoutDevice(actor, target.id, "device-1", new Date("2026-07-19T12:00:00Z"));
  assert.deepEqual(result, { success: true, deletedSessions: 2 });
  assert.deepEqual(state.deletedSessionScopes, [{ userId: target.id, deviceId: "device-1", channel: "web" }]);
  assert.deepEqual(state.deviceUpdates[0], { userId: target.id, deviceIds: ["device-1"], at: new Date("2026-07-19T12:00:00Z") });
  assert.equal(state.audits[0].action, "device_forced_logout");
  await assert.rejects(
    () => createDeviceAdminService(db).forceLogoutDevice(actor, "other-user", "device-1"),
    DeviceAdminNotFoundError,
  );
});

test("account logout deletes only target sessions and preserves audit snapshots", async () => {
  const { db, state } = fakeDatabase();
  const result = await createDeviceAdminService(db).forceLogoutAll(actor, target.id, new Date("2026-07-19T12:00:00Z"));
  assert.deepEqual(result, { success: true, deletedSessions: 2 });
  assert.deepEqual(state.deletedSessionScopes, [{ userId: target.id }]);
  assert.deepEqual(state.deviceUpdates[0], {
    userId: target.id,
    deviceIds: ["device-1", "device-2"],
    at: new Date("2026-07-19T12:00:00Z"),
  });
  assert.equal(state.audits[0].action, "account_forced_logout");
  assert.equal(state.audits[0].actorNameSnapshot, actor.name);
  assert.equal(state.audits[0].targetNameSnapshot, target.name);
});

test("all administrator routes use JSON API authentication instead of redirecting page authentication", () => {
  const paths = [
    "src/app/api/admin/device-policy/route.ts",
    "src/app/api/admin/accounts/[id]/devices/route.ts",
    "src/app/api/admin/accounts/[id]/devices/[deviceId]/route.ts",
    "src/app/api/admin/accounts/[id]/sessions/route.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /requireAdminApi/, path);
    assert.match(source, /runDeviceAdminRoute\(/, path);
    assert.doesNotMatch(source, /requireAdmin\(/, path);
  }
});

test("injectable administrator route wrapper maps authorization, invalid JSON, not-found and success", async () => {
  let called = false;
  const forbidden = await runDeviceAdminRoute({
    authenticate: async () => ({ ok: false, status: 403, body: { error: "无管理员权限" } }),
    action: async () => { called = true; return { success: true }; },
  });
  assert.equal(called, false);
  assert.deepEqual(forbidden, { status: 403, body: { error: "无管理员权限" } });

  const authenticate = async () => ({ ok: true as const, user: actor });
  const invalidJson = await runDeviceAdminRoute({
    authenticate,
    action: async () => JSON.parse("{"),
    inputErrorMessage: "参数无效",
  });
  assert.deepEqual(invalidJson, { status: 400, body: { error: "参数无效" } });

  const crossedDevice = await runDeviceAdminRoute({
    authenticate,
    action: async () => { throw new DeviceAdminNotFoundError(); },
    notFoundMessage: "设备不存在或不属于该账号",
  });
  assert.deepEqual(crossedDevice, { status: 404, body: { error: "设备不存在或不属于该账号" } });

  const success = await runDeviceAdminRoute({ authenticate, action: async (admin) => ({ actorId: admin.id }) });
  assert.deepEqual(success, { status: 200, body: { actorId: actor.id } });
});
