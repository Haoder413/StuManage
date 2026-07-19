import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const loginRoute = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
const logoutRoute = readFileSync(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8");
const loginUi = readFileSync(new URL("../components/login-page-client.tsx", import.meta.url), "utf8");

test("web login uses the unified device session service and both secure cookies", () => {
  assert.match(loginRoute, /createDeviceSession\s*\(/);
  assert.doesNotMatch(loginRoute, /createSession\s*\(/);
  assert.match(loginRoute, /DEVICE_COOKIE/);
  assert.match(loginRoute, /privacyAccepted\s*:\s*data\.privacyAccepted\s*===\s*true/);
  assert.match(loginRoute, /status:\s*409/);
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
