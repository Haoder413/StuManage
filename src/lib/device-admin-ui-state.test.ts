import assert from "node:assert/strict";
import test from "node:test";
import {
  deviceListKind,
  createLatestRequestGate,
  createOperationLock,
  loadAccountDevicePanel,
  loadGlobalPolicyPanel,
  logoutAccountDevices,
  logoutSingleDevice,
  restoreAccountDefaults,
  saveGlobalPolicyDraft,
  saveOverrideDraft,
  runOperationWithLock,
  shouldAcceptDeviceDialogOpenChange,
} from "./device-admin-ui-state";
import type { AccountDevicesResponse } from "./device-admin-client";

const policy = {
  webMobile: 2,
  webDesktop: 2,
  webTablet: 2,
  miniMobile: 2,
  miniDesktop: 2,
  miniTablet: 2,
};
const draft = Object.fromEntries(Object.entries(policy).map(([key, value]) => [key, String(value)])) as Record<keyof typeof policy, string>;
const accountPayload = {
  account: { id: "user-1", name: "王老师", phone: "13800000000", email: null, role: "teacher" },
  globalPolicy: policy,
  override: null,
  effectivePolicy: policy,
  devices: [
    {
      id: "old", channel: "web", deviceType: "desktop", displayName: "旧电脑", browser: "Chrome",
      operatingSystem: "Windows", lastIpAddress: "203.0.113.2", firstSeenAt: "2026-01-01T00:00:00Z",
      lastLoginAt: "2026-01-02T00:00:00Z", lastSeenAt: "2026-07-19T00:00:00Z", lastLogoutAt: "2026-07-19T01:00:00Z",
      activeSessionCount: 0,
    },
    {
      id: "active", channel: "miniProgram", deviceType: "mobile", displayName: "微信手机", browser: null,
      operatingSystem: "iOS", lastIpAddress: "203.0.113.1", firstSeenAt: "2026-02-01T00:00:00Z",
      lastLoginAt: "2026-07-18T00:00:00Z", lastSeenAt: "2026-07-18T01:00:00Z", lastLogoutAt: null,
      activeSessionCount: 2,
    },
  ],
} satisfies AccountDevicesResponse;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("latest request gate ignores stale responses and invalidates closed or unmounted panels", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const queue = [first, second];
  const gate = createLatestRequestGate();
  const states: Array<Record<string, unknown>> = [];
  const fetcher = () => queue.shift()!.promise;
  const oldLoad = loadAccountDevicePanel(fetcher, "user-1", (state) => states.push(state), gate);
  const newLoad = loadAccountDevicePanel(fetcher, "user-1", (state) => states.push(state), gate);
  second.resolve(json({ ...accountPayload, account: { ...accountPayload.account, name: "新结果" } }));
  await newLoad;
  first.resolve(json({ ...accountPayload, account: { ...accountPayload.account, name: "旧结果" } }));
  await oldLoad;
  const successes = states.filter((state) => state.phase === "success");
  assert.equal(successes.length, 1);
  assert.equal((successes[0]?.data as typeof accountPayload).account.name, "新结果");

  const closed = deferred<Response>();
  const closedStates: Array<Record<string, unknown>> = [];
  const closingLoad = loadAccountDevicePanel(() => closed.promise, "user-1", (state) => closedStates.push(state), gate);
  gate.invalidate();
  closed.resolve(json(accountPayload));
  assert.equal(await closingLoad, false);
  assert.deepEqual(closedStates.map((state) => state.phase), ["loading"]);
});

test("operation lock prevents duplicate mutations and only clears pending after completion", async () => {
  const lock = createOperationLock();
  const pending: boolean[] = [];
  const request = deferred<string>();
  let calls = 0;
  const first = runOperationWithLock(lock, (value) => pending.push(value), async () => {
    calls += 1;
    return request.promise;
  });
  const duplicate = await runOperationWithLock(lock, (value) => pending.push(value), async () => {
    calls += 1;
    return "duplicate";
  });
  assert.deepEqual(duplicate, { started: false });
  assert.equal(calls, 1);
  assert.equal(lock.pending(), true);
  assert.deepEqual(pending, [true]);
  request.resolve("done");
  assert.deepEqual(await first, { started: true, value: "done" });
  assert.equal(lock.pending(), false);
  assert.deepEqual(pending, [true, false]);
});

test("a pending mutation rejects close attempts, refreshes, then permits closing", async () => {
  const lock = createOperationLock();
  const request = deferred<void>();
  let open = true;
  let refreshes = 0;
  const operation = runOperationWithLock(lock, () => {}, async () => {
    await request.promise;
    refreshes += 1;
  });

  if (shouldAcceptDeviceDialogOpenChange(false, lock.pending())) open = false;
  assert.equal(open, true);
  assert.equal(refreshes, 0);

  request.resolve();
  await operation;
  assert.equal(refreshes, 1);
  if (shouldAcceptDeviceDialogOpenChange(false, lock.pending())) open = false;
  assert.equal(open, false);
});

test("account device loading makes no request before open and emits loading then active-first success after open", async () => {
  const calls: string[] = [];
  const states: Array<Record<string, unknown>> = [];
  const fetcher = async (url: string) => { calls.push(url); return json(accountPayload); };
  assert.equal(calls.length, 0);
  const loaded = await loadAccountDevicePanel(fetcher, "user-1", (state) => states.push(state));
  assert.equal(loaded, true);
  assert.deepEqual(calls, ["/api/admin/accounts/user-1/devices"]);
  assert.equal(states[0]?.phase, "loading");
  assert.equal(states[1]?.phase, "success");
  const data = states[1]?.data as typeof accountPayload;
  assert.equal(data.devices[0]?.id, "active");
  assert.deepEqual(
    Object.keys(data.devices[0] ?? {}).sort(),
    ["activeSessionCount", "browser", "channel", "deviceType", "displayName", "firstSeenAt", "id", "lastIpAddress", "lastLoginAt", "lastLogoutAt", "lastSeenAt", "operatingSystem"].sort(),
  );
  assert.equal(deviceListKind(data.devices), "list");
  assert.equal(deviceListKind([]), "empty");
});

test("account device loading exposes a visible server error state", async () => {
  const states: Array<Record<string, unknown>> = [];
  const result = await loadAccountDevicePanel(
    async () => json({ error: "设备服务暂不可用" }, 503),
    "user-1",
    (state) => states.push(state),
  );
  assert.equal(result, false);
  assert.deepEqual(states.map((state) => state.phase), ["loading", "error"]);
  assert.equal(states[1]?.message, "设备服务暂不可用");
});

test("single and all-device logout cancel without requests, then confirm DELETE and refresh", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  let refreshes = 0;
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    return json({ success: true, deletedSessions: 2 });
  };
  const refresh = async () => { refreshes += 1; return true; };
  assert.equal(await logoutSingleDevice({ fetcher, accountId: "user-1", deviceId: "d-1", displayName: "手机", confirm: () => false, refresh }), null);
  assert.equal(await logoutAccountDevices({ fetcher, accountId: "user-1", accountName: "王老师", confirm: () => false, refresh }), null);
  assert.equal(calls.length, 0);
  assert.equal(refreshes, 0);
  assert.equal(await logoutSingleDevice({ fetcher, accountId: "user-1", deviceId: "d-1", displayName: "手机", confirm: () => true, refresh }), "该设备已强制下线");
  assert.equal(await logoutAccountDevices({ fetcher, accountId: "user-1", accountName: "王老师", confirm: () => true, refresh }), "已退出 2 个有效登录");
  assert.deepEqual(calls, [
    { url: "/api/admin/accounts/user-1/devices/d-1", method: "DELETE" },
    { url: "/api/admin/accounts/user-1/sessions", method: "DELETE" },
  ]);
  assert.equal(refreshes, 2);
});

test("override save accepts empty inheritance and 1-20 values, while restore clears all six", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  let refreshes = 0;
  const fetcher = async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return json({ override: null });
  };
  const refresh = async () => { refreshes += 1; return true; };
  assert.equal(await saveOverrideDraft(fetcher, "user-1", { ...draft, webMobile: "", miniTablet: "20" }, refresh), "已保存该账号的设备上限");
  assert.equal(bodies[0]?.webMobile, null);
  assert.equal(bodies[0]?.miniTablet, 20);
  await assert.rejects(() => saveOverrideDraft(fetcher, "user-1", { ...draft, webMobile: "21" }, refresh), /1 至 20/);
  assert.equal(await restoreAccountDefaults(fetcher, "user-1", refresh), "已恢复使用全局默认上限");
  assert.deepEqual(Object.values(bodies[1] ?? {}), [null, null, null, null, null, null]);
  assert.equal(refreshes, 2);

  const originalDraft = { ...draft, webMobile: "7" };
  await assert.rejects(
    () => restoreAccountDefaults(async () => json({ error: "恢复失败" }, 500), "user-1", refresh),
    /恢复失败/,
  );
  assert.deepEqual(originalDraft, { ...draft, webMobile: "7" });
});

test("global policy loading and saving expose loading, error and success behavior", async () => {
  const states: Array<Record<string, unknown>> = [];
  await loadGlobalPolicyPanel(async () => json(policy), (state) => states.push(state));
  assert.deepEqual(states.map((state) => state.phase), ["loading", "success"]);
  const failedStates: Array<Record<string, unknown>> = [];
  assert.equal(await loadGlobalPolicyPanel(
    async () => json({ error: "策略加载失败" }, 500),
    (state) => failedStates.push(state),
  ), false);
  assert.deepEqual(failedStates.map((state) => state.phase), ["loading", "error"]);
  assert.equal(failedStates[1]?.message, "策略加载失败");
  const savedBodies: Array<Record<string, unknown>> = [];
  const saved = await saveGlobalPolicyDraft(async (_url, init) => {
    savedBodies.push(JSON.parse(String(init?.body)));
    return json(policy);
  }, { ...draft, webMobile: "1", miniTablet: "20" });
  assert.equal(saved.message, "已保存全局设备上限");
  assert.deepEqual(savedBodies[0], { ...policy, webMobile: 1, miniTablet: 20 });
  await assert.rejects(() => saveGlobalPolicyDraft(async () => json(policy), { ...draft, webDesktop: "" }), /1 至 20/);
});
