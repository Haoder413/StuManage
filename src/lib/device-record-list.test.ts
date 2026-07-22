import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { DeviceRecordList } from "@/components/device-record-list";
import type { AccountDevice } from "./device-admin-client";

const devices: AccountDevice[] = [
  {
    id: "active", channel: "miniProgram", deviceType: "mobile", displayName: "微信手机", browser: "微信",
    operatingSystem: "iOS", lastIpAddress: "203.0.113.1", firstSeenAt: "2026-01-01T00:00:00Z",
    lastLoginAt: "2026-07-18T00:00:00Z", lastSeenAt: "2026-07-18T01:00:00Z", lastLogoutAt: null,
    activeSessionCount: 2,
  },
  {
    id: "old", channel: "web", deviceType: "desktop", displayName: "旧电脑", browser: "Chrome",
    operatingSystem: "Windows", lastIpAddress: "203.0.113.2", firstSeenAt: "2026-02-01T00:00:00Z",
    lastLoginAt: "2026-02-02T00:00:00Z", lastSeenAt: "2026-02-03T00:00:00Z", lastLogoutAt: "2026-02-03T01:00:00Z",
    activeSessionCount: 0,
  },
];

test("device records render active-first safe metadata, session counts and all four timestamps", () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "UTC";
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(DeviceRecordList, {
      accountIdentifier: "13800000000",
      devices,
      onLogoutAll() {},
      onLogoutDevice() {},
      pending: true,
    }));
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
  assert.ok(html.indexOf("微信手机") < html.indexOf("旧电脑"));
  for (const text of ["小程序", "手机", "iOS · 微信", "203.0.113.1", "在线 · 2 个会话", "首次登录", "最近登录", "最近活跃", "最近退出"]) {
    assert.match(html, new RegExp(text));
  }
  assert.doesNotMatch(html, /deviceKeyHash|sessionToken|rawDeviceKey|Mozilla\//);
  assert.match(html, /2026\/7\/18 08:00:00/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 3);
});

test("device records render a clear empty state", () => {
  const html = renderToStaticMarkup(createElement(DeviceRecordList, {
    accountIdentifier: "未设置登录账号",
    devices: [],
    onLogoutAll() {},
    onLogoutDevice() {},
    pending: false,
  }));
  assert.match(html, /最近 90 天暂无登录设备/);
  assert.match(html, /disabled/);
});
