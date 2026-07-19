import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DeviceLimitError,
  describeUserAgent,
  deviceLimitMessage,
  getRequestIp,
  hasDeviceCapacity,
  normalizeDeviceSessionInput,
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
  assert.equal(
    normalizeDeviceSessionInput({ channel: "web", deviceKey: "a".repeat(32), privacyAccepted: true }).deviceKey,
    "a".repeat(32),
  );
  for (const deviceKey of ["a".repeat(31), "a".repeat(201), `${"a".repeat(31)}\n`]) {
    assert.throws(
      () => normalizeDeviceSessionInput({ channel: "web", deviceKey, privacyAccepted: true }),
      /设备标识/,
    );
  }
});

test("web device type comes from user agent and metadata is cleaned and limited", () => {
  const input = normalizeDeviceSessionInput({
    channel: "web",
    deviceKey: "b".repeat(32),
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

test("takes only the first trusted forwarding address and sanitizes it", () => {
  const values: Record<string, string> = {
    "x-forwarded-for": " 203.0.113.8\n, 10.0.0.1",
    "x-real-ip": "198.51.100.1",
  };
  const headers = { get: (name: string) => values[name] ?? null };
  assert.equal(getRequestIp(headers), "203.0.113.8");
  assert.equal(getRequestIp(new Headers({ "x-real-ip": " 198.51.100.2\t" })), "198.51.100.2");
  assert.equal(getRequestIp(new Headers()), null);
});

test("transaction source uses the scope guard, effective keyed limit, and device relation", () => {
  const source = readFileSync(new URL("./device-session.ts", import.meta.url), "utf8");
  assert.match(source, /\$transaction\s*\(\s*async/);
  assert.match(source, /assertDeviceSessionScope\s*\(/);
  assert.match(source, /deviceLimitKey\s*\(/);
  assert.match(source, /effectiveDeviceLimits\s*\(/);
  assert.match(source, /deviceId:\s*device\.id/);
  assert.match(source, /privacyConsent\.upsert/);
  assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+\w+\([^)]*deviceId/);
});
