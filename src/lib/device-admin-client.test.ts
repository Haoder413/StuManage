import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  forceLogoutAll,
  forceLogoutDevice,
  getAccountDevices,
  getDevicePolicy,
  parseGlobalLimitDraft,
  parseOverrideLimitDraft,
  saveAccountOverride,
  saveDevicePolicy,
} from "./device-admin-client";

const completeDraft = {
  webMobile: "1",
  webDesktop: "2",
  webTablet: "3",
  miniMobile: "4",
  miniDesktop: "5",
  miniTablet: "20",
};

test("global device limit drafts accept only six integers from 1 through 20", () => {
  assert.deepEqual(parseGlobalLimitDraft(completeDraft), {
    webMobile: 1,
    webDesktop: 2,
    webTablet: 3,
    miniMobile: 4,
    miniDesktop: 5,
    miniTablet: 20,
  });
  assert.throws(() => parseGlobalLimitDraft({ ...completeDraft, webMobile: "" }), /请填写 1 至 20/);
  assert.throws(() => parseGlobalLimitDraft({ ...completeDraft, webMobile: "2.5" }), /请填写 1 至 20/);
  assert.throws(() => parseGlobalLimitDraft({ ...completeDraft, webMobile: "21" }), /请填写 1 至 20/);
});

test("account override drafts use null for empty inherited values", () => {
  assert.deepEqual(parseOverrideLimitDraft({ ...completeDraft, webMobile: "", miniTablet: "" }), {
    webMobile: null,
    webDesktop: 2,
    webTablet: 3,
    miniMobile: 4,
    miniDesktop: 5,
    miniTablet: null,
  });
  assert.throws(() => parseOverrideLimitDraft({ ...completeDraft, webDesktop: "0" }), /请填写 1 至 20/);
});

test("device list is fetched lazily from the selected account endpoint", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ account: { id: "a/b", name: "王老师" }, devices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  assert.equal(calls.length, 0);
  const result = await getAccountDevices(fetcher, "a/b");
  assert.equal(result.account.name, "王老师");
  assert.equal(calls[0]?.url, "/api/admin/accounts/a%2Fb/devices");
});

test("account override sends all six nullable values and preserves server errors", async () => {
  const received: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    received.push({ url, init });
    return new Response(JSON.stringify({ error: "服务端拒绝了本次设置" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };
  await assert.rejects(
    () => saveAccountOverride(fetcher, "user-1", parseOverrideLimitDraft({ ...completeDraft, webMobile: "" })),
    /服务端拒绝了本次设置/,
  );
  assert.equal(received[0]?.url, "/api/admin/accounts/user-1/devices");
  assert.equal(received[0]?.init?.method, "PATCH");
  assert.equal(JSON.parse(String(received[0]?.init?.body)).webMobile, null);
});

test("force logout and global policy clients use the administrator endpoints", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    if (url === "/api/admin/device-policy" && !init) {
      return new Response(JSON.stringify(parseGlobalLimitDraft(completeDraft)), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, deletedSessions: 1, ...parseGlobalLimitDraft(completeDraft) }), { status: 200 });
  };
  assert.equal((await getDevicePolicy(fetcher)).webMobile, 1);
  await saveDevicePolicy(fetcher, parseGlobalLimitDraft(completeDraft));
  await forceLogoutDevice(fetcher, "user/1", "device/1");
  await forceLogoutAll(fetcher, "user/1");
  assert.deepEqual(calls, [
    { url: "/api/admin/device-policy", method: undefined },
    { url: "/api/admin/device-policy", method: "PATCH" },
    { url: "/api/admin/accounts/user%2F1/devices/device%2F1", method: "DELETE" },
    { url: "/api/admin/accounts/user%2F1/sessions", method: "DELETE" },
  ]);
});

test("administrator pages wire the device dialog and global policy card", () => {
  const accounts = readFileSync("src/app/accounts/account-manager.tsx", "utf8");
  const deviceDialog = readFileSync("src/components/account-device-dialog.tsx", "utf8");
  const settings = readFileSync("src/components/settings-client.tsx", "utf8");
  assert.match(accounts, /AccountDeviceDialog/);
  assert.match(deviceDialog, /登录设备/);
  assert.match(deviceDialog, /requestGate\.current\.invalidate\(\)/);
  assert.match(deviceDialog, /shouldAcceptDeviceDialogOpenChange\(nextOpen, operationLock\.current\.pending\(\)\)/);
  assert.match(deviceDialog, /操作完成后可关闭/);
  const restoreHandler = deviceDialog.match(/async function restoreDefaults\(\)[\s\S]*?async function logoutDevice/)?.[0] ?? "";
  assert.doesNotMatch(restoreHandler, /setDraft\(/);
  assert.doesNotMatch(deviceDialog, /deviceKeyHash|sessionToken|rawDeviceKey/);
  assert.match(settings, /role === "admin"[\s\S]*DevicePolicyCard/);
});
