import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DeviceLimitError, DeviceSessionValidationError } from "./device-session";
import {
  deviceCookieOptions,
  parseWebLoginRequest,
  sessionCookieOptions,
  webLoginErrorResponse,
} from "./web-login";

const loginRoute = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
const logoutRoute = readFileSync(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8");
const loginUi = readFileSync(new URL("../components/login-page-client.tsx", import.meta.url), "utf8");

test("web login uses the unified device session service and both secure cookies", () => {
  assert.match(loginRoute, /createDeviceSession\s*\(/);
  assert.doesNotMatch(loginRoute, /createSession\s*\(/);
  assert.match(loginRoute, /DEVICE_COOKIE/);
  assert.match(loginRoute, /privacyAccepted/);
  assert.match(loginRoute, /parseWebLoginRequest\s*\(/);
  assert.match(loginRoute, /webLoginErrorResponse\s*\(/);
  assert.ok(loginRoute.indexOf("parseWebLoginRequest(data)") < loginRoute.indexOf("prisma.user.findFirst"));
});

test("rejects missing privacy consent before returning parsed credentials", () => {
  assert.deepEqual(parseWebLoginRequest({ identifier: "known@example.com", password: "secret" }), {
    ok: false,
    error: { status: 400, body: { error: "请先阅读并同意设备登录与隐私说明" } },
  });
  assert.equal(parseWebLoginRequest({ identifier: "known@example.com", password: "secret", privacyAccepted: true }).ok, true);
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

test("login UI requires consent, explains recorded metadata, and submits consent", () => {
  assert.match(loginUi, /type="checkbox"/);
  assert.match(loginUi, /privacyAccepted/);
  for (const phrase of ["设备类型", "浏览器", "操作系统", "IP", "登录/活跃时间", "90 天"]) {
    assert.match(loginUi, new RegExp(phrase));
  }
  assert.match(loginUi, /JSON\.stringify\(\{[^}]*privacyAccepted/);
});
