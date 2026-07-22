import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import {
  executeMobileLogin,
  parseMobileLoginRequest,
  resolveMiniDeviceKey,
} from "./mobile-login";
import {
  createPrismaMobileAuthDatabase,
  createPrismaMobileSessionRevocationDatabase,
  findMobileCurrentUser,
  revokeMobileSession,
  type MobileAuthDatabase,
  type MobileSessionRevocationDatabase,
} from "./mobile-auth";

const require = createRequire(import.meta.url);
const miniDeviceLogin = require("../../miniprogram/utils/device-login.js") as {
  readStoredDeviceKey(wxApi: { getStorageSync(key: string): unknown }): string;
  saveDeviceKey(wxApi: { setStorageSync(key: string, value: string): void }, value: unknown): boolean;
  miniDeviceInfo(wxApi: Record<string, unknown>): {
    deviceType: string;
    displayName: string;
    operatingSystem: string;
    clientVersion: string;
  };
  isValidSessionToken(value: unknown): boolean;
};

function validKey(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

test("parses privacy before credentials and accepts a missing first-login device key", () => {
  const missingConsent = parseMobileLoginRequest({ identifier: "parent", password: "secret" });
  assert.deepEqual(missingConsent, {
    ok: false,
    error: { status: 400, body: { error: "请先阅读并同意设备登录与隐私说明" } },
  });

  const parsed = parseMobileLoginRequest({
    identifier: " parent@example.com ",
    password: "secret",
    privacyAccepted: true,
    deviceKey: "corrupt-key",
    deviceType: "tablet",
    displayName: "Apple iPad",
    operatingSystem: "iOS 18",
    clientVersion: "8.0.50",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.identifier, "parent@example.com");
    assert.equal(parsed.value.deviceKey, "corrupt-key");
    assert.equal(parsed.value.deviceType, "tablet");
  }
});

test("server reuses only a valid key and self-heals missing or corrupt keys", () => {
  const existing = validKey("existing-mini-device");
  assert.deepEqual(resolveMiniDeviceKey(existing, () => validKey("replacement")), {
    deviceKey: existing,
    replaced: false,
  });
  assert.deepEqual(resolveMiniDeviceKey("corrupt", () => validKey("replacement")), {
    deviceKey: validKey("replacement"),
    replaced: true,
  });
  assert.deepEqual(resolveMiniDeviceKey(undefined, () => validKey("first-login")), {
    deviceKey: validKey("first-login"),
    replaced: true,
  });
});

test("mobile login uses the mini-program pool, returns the raw stable key, and keeps a uniform credential path", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const replacement = validKey("server-generated");
  const result = await executeMobileLogin(
    {
      identifier: "known@example.com",
      password: "secret",
      privacyAccepted: true,
      deviceKey: "damaged",
      deviceType: "mobile",
      displayName: "Xiaomi 15",
      operatingSystem: "Android 16",
      clientVersion: "8.0.50",
    },
    { userAgent: "MicroMessenger", ipAddress: "198.51.100.3" },
    {
      findUser: async () => ({ id: "user-1", name: "家长", role: "parent", passwordHash: "stored" }),
      verifyLoginPassword: (password, user) => password === "secret" && user?.passwordHash === "stored",
      createDeviceSession: async (userId, input) => {
        calls.push({ userId, ...input });
        return { token: "token", expiresAt: new Date("2026-08-01T00:00:00Z") };
      },
      generateDeviceKey: () => replacement,
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.deviceKey, replacement);
  assert.equal(result.body.token, "token");
  assert.deepEqual(calls, [{
    userId: "user-1",
    channel: "miniProgram",
    deviceKey: replacement,
    deviceType: "mobile",
    displayName: "Xiaomi 15",
    operatingSystem: "Android 16",
    clientVersion: "8.0.50",
    userAgent: "MicroMessenger",
    ipAddress: "198.51.100.3",
    privacyAccepted: true,
  }]);

  let verificationUser: unknown = "not-called";
  const unknown = await executeMobileLogin(
    { identifier: "missing", password: "bad", privacyAccepted: true },
    {},
    {
      findUser: async () => null,
      verifyLoginPassword: (_password, user) => { verificationUser = user; return false; },
      createDeviceSession: async () => { throw new Error("must not create"); },
      generateDeviceKey: () => replacement,
    },
  );
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.body, { error: "账号或密码不正确" });
  assert.equal(verificationUser, null);
});

test("mini client stores only server-issued valid keys and derives official device metadata", () => {
  const stored = validKey("stored");
  assert.equal(miniDeviceLogin.readStoredDeviceKey({ getStorageSync: () => stored }), stored);
  assert.equal(miniDeviceLogin.readStoredDeviceKey({ getStorageSync: () => "broken" }), "");

  const writes: Array<[string, string]> = [];
  assert.equal(miniDeviceLogin.saveDeviceKey({ setStorageSync: (key, value) => writes.push([key, value]) }, stored), true);
  assert.equal(miniDeviceLogin.saveDeviceKey({ setStorageSync: () => { throw new Error("must not write"); } }, "broken"), false);
  assert.deepEqual(writes, [["loginDeviceKey", stored]]);

  assert.deepEqual(miniDeviceLogin.miniDeviceInfo({
    getDeviceInfo: () => ({ brand: "Apple", model: "iPad Pro", system: "iOS 18.0", platform: "ios" }),
    getAppBaseInfo: () => ({ version: "8.0.50", SDKVersion: "3.7.8" }),
  }), {
    deviceType: "tablet",
    displayName: "Apple iPad Pro",
    operatingSystem: "iOS 18.0",
    clientVersion: "8.0.50",
  });

  assert.equal(miniDeviceLogin.readStoredDeviceKey({ getStorageSync: () => { throw new Error("storage disabled"); } }), "");
  assert.equal(miniDeviceLogin.miniDeviceInfo({
    getDeviceInfo: () => ({ brand: "Huawei", model: "MatePad Pro", system: "HarmonyOS 5", deviceType: "pad" }),
    getAppBaseInfo: () => ({ version: "8.0.51" }),
  }).deviceType, "tablet");
  assert.equal(miniDeviceLogin.miniDeviceInfo({
    getDeviceInfo: () => ({ brand: "Xiaomi", model: "Xiaomi Pad 7", system: "Android 15", deviceCategory: "tablet" }),
    getAppBaseInfo: () => ({ version: "8.0.51" }),
  }).deviceType, "tablet");
  assert.equal(miniDeviceLogin.miniDeviceInfo({
    getDeviceInfo: () => ({ brand: "Google", model: "Pixel 9", system: "Android 15", deviceType: "phone" }),
    getAppBaseInfo: () => ({ version: "8.0.51" }),
  }).deviceType, "mobile");
  assert.equal(miniDeviceLogin.isValidSessionToken(validKey("session-token")), true);
  assert.equal(miniDeviceLogin.isValidSessionToken(""), false);
  assert.equal(miniDeviceLogin.isValidSessionToken(undefined), false);
});

test("mobile authentication accepts only owned mini-program device sessions and throttles activity", async () => {
  const touches: string[] = [];
  const database: MobileAuthDatabase = {
    findSession: async () => ({
      id: "session-1",
      userId: "user-1",
      channel: "miniProgram",
      deviceId: "device-1",
      lastSeenAt: new Date("2026-07-19T10:00:00Z"),
      device: { id: "device-1", userId: "user-1", channel: "miniProgram" },
      user: { id: "user-1", name: "家长", role: "parent", workspaceId: "workspace-1" },
    }),
    touchActivity: async (session, now) => { touches.push(`${session.id}:${now.toISOString()}`); },
  };
  const now = new Date("2026-07-19T12:00:00Z");
  const user = await findMobileCurrentUser("raw-token", database, now);
  assert.equal(user?.id, "user-1");
  assert.deepEqual(touches, [`session-1:${now.toISOString()}`]);

  const freshDatabase: MobileAuthDatabase = {
    ...database,
    findSession: async () => ({
      id: "session-fresh",
      userId: "user-1",
      channel: "miniProgram",
      deviceId: "device-1",
      lastSeenAt: new Date("2026-07-19T11:58:00Z"),
      device: { id: "device-1", userId: "user-1", channel: "miniProgram" },
      user: { id: "user-1", name: "家长", role: "parent", workspaceId: "workspace-1" },
    }),
  };
  await findMobileCurrentUser("raw-token", freshDatabase, now);
  assert.deepEqual(touches, [`session-1:${now.toISOString()}`]);

  const crossed: MobileAuthDatabase = {
    ...database,
    findSession: async () => ({
      id: "session-2",
      userId: "user-1",
      channel: "miniProgram",
      deviceId: "device-2",
      lastSeenAt: null,
      device: { id: "device-2", userId: "other-user", channel: "miniProgram" },
      user: { id: "user-1", name: "家长", role: "parent", workspaceId: "workspace-1" },
    }),
  };
  assert.equal(await findMobileCurrentUser("raw-token", crossed, now), null);

  const legacy: MobileAuthDatabase = {
    ...database,
    findSession: async () => ({
      id: "legacy-session",
      userId: "user-1",
      channel: null,
      deviceId: null,
      lastSeenAt: null,
      device: null,
      user: { id: "user-1", name: "家长", role: "parent", workspaceId: "workspace-1" },
    }),
  };
  assert.equal(await findMobileCurrentUser("legacy-token", legacy, now), null);

  const missingDeviceId: MobileAuthDatabase = {
    ...database,
    findSession: async () => ({
      id: "unbound-session",
      userId: "user-1",
      channel: "miniProgram",
      deviceId: null,
      lastSeenAt: null,
      device: { id: "device-1", userId: "user-1", channel: "miniProgram" },
      user: { id: "user-1", name: "家长", role: "parent", workspaceId: "workspace-1" },
    }),
  };
  assert.equal(await findMobileCurrentUser("unbound-token", missingDeviceId, now), null);
});

test("mini login UI requires privacy consent and persists the server-issued key", () => {
  const page = readFileSync(new URL("../../miniprogram/pages/login/index.js", import.meta.url), "utf8");
  const markup = readFileSync(new URL("../../miniprogram/pages/login/index.wxml", import.meta.url), "utf8");
  assert.match(page, /privacyAccepted/);
  assert.match(page, /readStoredDeviceKey/);
  assert.match(page, /miniDeviceInfo/);
  assert.match(page, /saveDeviceKey\([^,]+,\s*data\.deviceKey\)/);
  assert.match(page, /data:\s*\{[\s\S]*deviceKey[\s\S]*deviceType[\s\S]*displayName[\s\S]*operatingSystem[\s\S]*clientVersion[\s\S]*privacyAccepted/);
  assert.match(markup, /checkbox/);
  assert.match(markup, /历史记录保存 90 天/);
  assert.match(markup, /小程序客户端版本/);
  assert.match(page, /if\s*\(this\.data\.loading\)\s*return/);
  assert.match(page, /request\("\/auth\/session"[\s\S]*method:\s*"DELETE"[\s\S]*token:\s*data\.token/);
});

test("Prisma mobile auth lookup is restricted to owned mini-program device sessions", async () => {
  let query: any;
  const client = {
    session: {
      findFirst: async (args: unknown) => { query = args; return null; },
    },
  };
  const database = createPrismaMobileAuthDatabase(client as never);
  await database.findSession("hash", new Date("2026-07-19T12:00:00Z"));
  assert.equal(query.where.channel, "miniProgram");
  assert.deepEqual(query.where.deviceId, { not: null });
  assert.equal(query.where.device.is.channel, "miniProgram");
  assert.deepEqual(query.where.expiresAt, { gt: new Date("2026-07-19T12:00:00Z") });
  assert.deepEqual(query.include.device.select, { id: true, userId: true, channel: true });
});

test("storage-failure compensation revokes only the current mini-program session token", async () => {
  const revoked: string[] = [];
  const database: MobileSessionRevocationDatabase = {
    revokeSession: async (tokenHash) => { revoked.push(tokenHash); },
  };
  await revokeMobileSession("current-raw-token", database);
  assert.deepEqual(revoked, [createHash("sha256").update("current-raw-token").digest("hex")]);
});

test("Prisma compensation scopes revocation to the exact mini-program session", async () => {
  const calls: Array<{ name: string; args: any }> = [];
  const transaction = {
    session: {
      findFirst: async (args: any) => {
        calls.push({ name: "find", args });
        return { id: "session-1", userId: "user-1", deviceId: "device-1" };
      },
      deleteMany: async (args: any) => { calls.push({ name: "delete", args }); return { count: 1 }; },
    },
    loginDevice: {
      updateMany: async (args: any) => { calls.push({ name: "logout", args }); return { count: 1 }; },
    },
  };
  const database = createPrismaMobileSessionRevocationDatabase({
    $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
  } as never);
  await database.revokeSession("token-hash", new Date("2026-07-19T12:00:00Z"));
  assert.deepEqual(calls[0].args.where, { tokenHash: "token-hash", channel: "miniProgram" });
  assert.deepEqual(calls[1].args.where, { id: "device-1", userId: "user-1" });
  assert.deepEqual(calls[2].args.where, { id: "session-1", userId: "user-1", channel: "miniProgram" });

  const route = readFileSync(new URL("../app/api/mobile/auth/session/route.ts", import.meta.url), "utf8");
  assert.match(route, /getMobileBearerToken/);
  assert.match(route, /revokeMobileSession/);
});

test("mini login blocks duplicate taps and compensates when the server key cannot be stored", async () => {
  const pagePath = require.resolve("../../miniprogram/pages/login/index.js");
  const requests: any[] = [];
  let pageDefinition: any;
  const originalPage = (globalThis as any).Page;
  const originalWx = (globalThis as any).wx;
  const originalGetApp = (globalThis as any).getApp;

  try {
    (globalThis as any).Page = (definition: any) => { pageDefinition = definition; };
    (globalThis as any).getApp = () => ({ globalData: { apiBaseUrl: "https://example.test/api/mobile", token: "" } });
    (globalThis as any).wx = {
      getStorageSync: () => "",
      setStorageSync: (key: string) => {
        if (key === "loginDeviceKey") throw new Error("storage full");
      },
      getDeviceInfo: () => ({ brand: "Google", model: "Pixel 9", system: "Android 15", deviceType: "phone" }),
      getAppBaseInfo: () => ({ version: "8.0.51" }),
      request: (options: any) => {
        requests.push(options);
        if (options.method === "DELETE") {
          setImmediate(() => options.success({ statusCode: 200, data: { success: true } }));
        }
      },
      switchTab: () => { throw new Error("must not navigate when device storage fails"); },
      showToast: () => {},
      redirectTo: () => {},
      removeStorageSync: () => {},
    };
    delete require.cache[pagePath];
    require(pagePath);

    const context = {
      data: { ...pageDefinition.data, identifier: "parent@example.com", password: "secret", privacyAccepted: true },
      setData(update: Record<string, unknown>) { Object.assign(this.data, update); },
    };
    pageDefinition.login.call(context);
    pageDefinition.login.call(context);
    assert.equal(requests.length, 1);
    assert.equal(context.data.loading, true);

    const serverKey = validKey("server-key-for-storage-failure");
    const currentSessionToken = validKey("only-this-session-token");
    requests[0].success({
      statusCode: 200,
      data: { token: currentSessionToken, deviceKey: serverKey, user: { id: "user-1" } },
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(requests.length, 2);
    assert.equal(requests[1].method, "DELETE");
    assert.equal(requests[1].header.Authorization, `Bearer ${currentSessionToken}`);
    assert.equal(context.data.loading, false);
    assert.match(String(context.data.message), /设备信息保存失败/);

    pageDefinition.login.call(context);
    assert.equal(requests.length, 3);
  } finally {
    delete require.cache[pagePath];
    (globalThis as any).Page = originalPage;
    (globalThis as any).wx = originalWx;
    (globalThis as any).getApp = originalGetApp;
  }
});

test("missing or empty login tokens never save a key or compensate with an old stored session", async (t) => {
  for (const invalidToken of [undefined, ""]) {
    await t.test(invalidToken === undefined ? "missing token" : "empty token", async () => {
      const pagePath = require.resolve("../../miniprogram/pages/login/index.js");
      const requests: any[] = [];
      const writes: string[] = [];
      let pageDefinition: any;
      const originalPage = (globalThis as any).Page;
      const originalWx = (globalThis as any).wx;
      const originalGetApp = (globalThis as any).getApp;
      try {
        (globalThis as any).Page = (definition: any) => { pageDefinition = definition; };
        (globalThis as any).getApp = () => ({
          globalData: { apiBaseUrl: "https://example.test/api/mobile", token: "old-session-token" },
        });
        (globalThis as any).wx = {
          getStorageSync: (key: string) => key === "mobileToken" ? "old-session-token" : "",
          setStorageSync: (key: string) => { writes.push(key); },
          getDeviceInfo: () => ({ brand: "Google", model: "Pixel 9", system: "Android 15", deviceType: "phone" }),
          getAppBaseInfo: () => ({ version: "8.0.51" }),
          request: (options: any) => { requests.push(options); },
          switchTab: () => { throw new Error("must not navigate for an invalid login response"); },
          showToast: () => {},
          redirectTo: () => {},
          removeStorageSync: () => {},
        };
        delete require.cache[pagePath];
        require(pagePath);
        const context = {
          data: { ...pageDefinition.data, identifier: "parent@example.com", password: "secret", privacyAccepted: true },
          setData(update: Record<string, unknown>) { Object.assign(this.data, update); },
        };
        pageDefinition.login.call(context);
        requests[0].success({
          statusCode: 200,
          data: { token: invalidToken, deviceKey: validKey("server-device-key"), user: { id: "user-1" } },
        });
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(requests.length, 1);
        assert.deepEqual(writes, []);
        assert.equal(context.data.loading, false);
        assert.match(String(context.data.message), /登录响应异常/);
      } finally {
        delete require.cache[pagePath];
        (globalThis as any).Page = originalPage;
        (globalThis as any).wx = originalWx;
        (globalThis as any).getApp = originalGetApp;
      }
    });
  }
});

test("an explicitly empty request token never falls back to an old stored token", async () => {
  const apiPath = require.resolve("../../miniprogram/utils/api.js");
  const originalWx = (globalThis as any).wx;
  const originalGetApp = (globalThis as any).getApp;
  let requestCount = 0;
  try {
    (globalThis as any).getApp = () => ({ globalData: { apiBaseUrl: "https://example.test", token: "old-token" } });
    (globalThis as any).wx = {
      getStorageSync: () => "old-token",
      request: () => { requestCount += 1; },
    };
    delete require.cache[apiPath];
    const api = require(apiPath) as {
      request(path: string, options: Record<string, unknown>): Promise<unknown>;
      resolveRequestToken(options: Record<string, unknown>, storedToken: string): string;
    };
    assert.equal(api.resolveRequestToken({}, "old-token"), "old-token");
    assert.equal(api.resolveRequestToken({ token: "" }, "old-token"), "");
    assert.equal(api.resolveRequestToken({ token: undefined }, "old-token"), "");
    await assert.rejects(() => api.request("/auth/session", { method: "DELETE", token: "" }), /会话凭据无效/);
    assert.equal(requestCount, 0);
  } finally {
    delete require.cache[apiPath];
    (globalThis as any).wx = originalWx;
    (globalThis as any).getApp = originalGetApp;
  }
});
