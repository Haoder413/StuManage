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
import { findMobileCurrentUser, type MobileAuthDatabase } from "./mobile-auth";

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
});
