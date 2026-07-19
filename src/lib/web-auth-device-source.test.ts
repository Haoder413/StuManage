import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DeviceLimitError, DeviceSessionValidationError } from "./device-session";
import { DUMMY_PASSWORD_HASH, verifyLoginPassword, verifyPassword } from "./password";
import {
  deviceCookieOptions,
  parseWebLoginRequest,
  sessionCookieOptions,
  isSecureRequest,
  resolveDeviceKey,
  webLoginErrorResponse,
} from "./web-login";

const loginRoute = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
const logoutRoute = readFileSync(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8");
const loginUi = readFileSync(new URL("../components/login-page-client.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");

test("web login uses the unified device session service and both secure cookies", () => {
  assert.match(loginRoute, /createDeviceSession\s*\(/);
  assert.doesNotMatch(loginRoute, /createSession\s*\(/);
  assert.match(loginRoute, /DEVICE_COOKIE/);
  assert.match(loginRoute, /privacyAccepted/);
  assert.match(loginRoute, /parseWebLoginRequest\s*\(/);
  assert.match(loginRoute, /webLoginErrorResponse\s*\(/);
  assert.match(loginRoute, /verifyLoginPassword\s*\(/);
  assert.match(loginRoute, /resolveDeviceKey\s*\(/);
  assert.match(loginRoute, /isSecureRequest\s*\(/);
  assert.ok(loginRoute.indexOf("parseWebLoginRequest(data)") < loginRoute.indexOf("prisma.user.findFirst"));
});

test("rejects missing privacy consent before returning parsed credentials", () => {
  assert.deepEqual(parseWebLoginRequest({ identifier: "known@example.com", password: "secret" }), {
    ok: false,
    error: { status: 400, body: { error: "请先阅读并同意设备登录与隐私说明" } },
  });
  assert.equal(parseWebLoginRequest({ identifier: "known@example.com", password: "secret", privacyAccepted: true }).ok, true);
});

test("uses a fixed valid PBKDF2 dummy hash when the account does not exist", () => {
  const calls: string[] = [];
  assert.equal(
    verifyLoginPassword("secret", null, (password, hash) => {
      calls.push(`${password}:${hash}`);
      return verifyPassword(password, hash);
    }),
    false,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], new RegExp(`^secret:${DUMMY_PASSWORD_HASH.replace(/\$/g, "\\$")}$`));
  assert.equal(verifyPassword("fixed-dummy-password", DUMMY_PASSWORD_HASH), true);
  assert.equal(verifyPassword("secret", DUMMY_PASSWORD_HASH), false);
});

test("replaces missing or damaged device cookies with a valid random key", () => {
  const generated = "0123456789abcdef".repeat(4).replace(/^0123456789abcdef/, "89abcdef01234567");
  assert.equal(resolveDeviceKey(undefined, () => generated), generated);
  assert.equal(resolveDeviceKey("damaged-cookie", () => generated), generated);
  const valid = randomBytes(32).toString("hex");
  assert.equal(resolveDeviceKey(valid, () => generated), valid);
});

test("forces secure cookies in production and trusts only the canonical URL in development", () => {
  assert.equal(isSecureRequest({ nodeEnv: "production", protocol: "http:" }), true);
  assert.equal(isSecureRequest({ nodeEnv: "development", protocol: "https:" }), true);
  assert.equal(isSecureRequest({ nodeEnv: "development", protocol: "http:" }), false);
});

test("maps known login errors and hides unknown internals", () => {
  assert.deepEqual(webLoginErrorResponse(new DeviceLimitError(2, "webDesktop")), {
    status: 409,
    body: { error: "该账号此类设备已达到 2 台，请联系管理员或先退出其他设备", code: "DEVICE_LIMIT_REACHED" },
  });
  assert.deepEqual(webLoginErrorResponse(new DeviceSessionValidationError("坏输入")), {
    status: 400,
    body: { error: "坏输入", code: "INVALID_DEVICE_SESSION_INPUT" },
  });
  assert.deepEqual(webLoginErrorResponse(new Error("database password leaked")), {
    status: 500,
    body: { error: "登录失败，请稍后重试" },
  });
});

test("builds hardened session and one-year device cookie options", () => {
  const expires = new Date("2026-08-02T00:00:00.000Z");
  assert.deepEqual(sessionCookieOptions(true, expires), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires,
  });
  assert.deepEqual(deviceCookieOptions(false), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
});

test("logout clears only session and role cookies, not the device cookie", () => {
  assert.match(logoutRoute, /clearSession\s*\(/);
  assert.doesNotMatch(logoutRoute, /DEVICE_COOKIE|student_management_device/);
});

test("auth touches stale activity and uses transactional device logout without logging tokens", () => {
  assert.match(authSource, /touchSessionActivity\s*\(session\)/);
  assert.match(authSource, /logoutDeviceSession\s*\(hashToken\(token\)\)/);
  assert.doesNotMatch(authSource, /console\.(?:error|log)\([^\n]*(?:token|tokenHash)/i);
});

test("login UI requires consent, explains recorded metadata, and submits consent", () => {
  assert.match(loginUi, /type="checkbox"/);
  assert.match(loginUi, /privacyAccepted/);
  for (const phrase of ["设备类型", "浏览器", "操作系统", "IP", "登录/活跃时间", "90 天"]) {
    assert.match(loginUi, new RegExp(phrase));
  }
  assert.match(loginUi, /JSON\.stringify\(\{[^}]*privacyAccepted/);
});
