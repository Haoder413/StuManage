"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeviceRecordList } from "@/components/device-record-list";
import { DeviceLimitFields } from "@/components/device-limit-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  limitsToDraft,
  type AccountDevicesResponse,
  type DeviceLimitDraft,
} from "@/lib/device-admin-client";
import {
  createLatestRequestGate,
  createOperationLock,
  loadAccountDevicePanel,
  logoutAccountDevices,
  logoutSingleDevice,
  restoreAccountDefaults,
  runOperationWithLock,
  saveOverrideDraft,
  shouldAcceptDeviceDialogOpenChange,
} from "@/lib/device-admin-ui-state";

type AccountSummary = { id: string; name: string };

export function AccountDeviceDialog({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AccountDevicesResponse | null>(null);
  const [draft, setDraft] = useState<DeviceLimitDraft>(() => limitsToDraft(null));
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const requestGate = useRef(createLatestRequestGate());
  const operationLock = useRef(createOperationLock());
  const lifecycle = useRef({ mounted: true, open: false, generation: 0 });

  useEffect(() => {
    lifecycle.current.mounted = true;
    return () => {
      lifecycle.current.mounted = false;
      lifecycle.current.open = false;
      lifecycle.current.generation += 1;
      requestGate.current.invalidate();
    };
  }, []);

  function isActive(generation: number) {
    const current = lifecycle.current;
    return current.mounted && current.open && current.generation === generation;
  }

  function setOperationPending(nextPending: boolean) {
    if (lifecycle.current.mounted) setPending(nextPending);
  }

  async function load() {
    return loadAccountDevicePanel(fetch, account.id, (state) => {
      if (state.phase === "loading") {
        setLoading(true);
        setMessage("");
        return;
      }
      setLoading(false);
      if (state.phase === "error") {
        setData(null);
        setMessage(state.message);
        return;
      }
      setData(state.data);
      setDraft(limitsToDraft(state.data.override));
    }, requestGate.current);
  }

  function openDialog() {
    lifecycle.current.open = true;
    setOpen(true);
    void load();
  }

  function changeOpen(nextOpen: boolean) {
    if (!shouldAcceptDeviceDialogOpenChange(nextOpen, operationLock.current.pending())) {
      setMessage("操作进行中，操作完成后可关闭");
      return;
    }
    if (!nextOpen) {
      lifecycle.current.open = false;
      lifecycle.current.generation += 1;
      requestGate.current.invalidate();
      setLoading(false);
    }
    setOpen(nextOpen);
  }

  async function saveOverride() {
    const generation = lifecycle.current.generation;
    try {
      const result = await runOperationWithLock(operationLock.current, setOperationPending, () => {
        setMessage("");
        return saveOverrideDraft(fetch, account.id, draft, () => isActive(generation) ? load() : Promise.resolve(false));
      });
      if (result.started && result.value && isActive(generation)) setMessage(result.value);
    } catch (error) {
      if (isActive(generation)) setMessage(errorMessage(error, "保存失败"));
    }
  }

  async function restoreDefaults() {
    const generation = lifecycle.current.generation;
    try {
      const result = await runOperationWithLock(operationLock.current, setOperationPending, () => {
        setMessage("");
        return restoreAccountDefaults(fetch, account.id, () => isActive(generation) ? load() : Promise.resolve(false));
      });
      if (result.started && result.value && isActive(generation)) setMessage(result.value);
    } catch (error) {
      if (isActive(generation)) setMessage(errorMessage(error, "恢复失败"));
    }
  }

  async function logoutDevice(deviceId: string, displayName: string) {
    if (operationLock.current.pending()) return;
    if (!window.confirm(`确认让“${displayName}”退出登录？该设备需要重新输入账号密码。`)) return;
    const generation = lifecycle.current.generation;
    try {
      const result = await runOperationWithLock(operationLock.current, setOperationPending, () => {
        setMessage("");
        return logoutSingleDevice({
          fetcher: fetch,
          accountId: account.id,
          deviceId,
          displayName,
          confirm: () => true,
          refresh: () => isActive(generation) ? load() : Promise.resolve(false),
        });
      });
      if (result.started && result.value && isActive(generation)) setMessage(result.value);
    } catch (error) {
      if (isActive(generation)) setMessage(errorMessage(error, "设备下线失败"));
    }
  }

  async function logoutAll() {
    if (operationLock.current.pending()) return;
    if (!window.confirm(`确认让“${account.name}”的所有设备退出登录？网页端和小程序都需要重新登录。`)) return;
    const generation = lifecycle.current.generation;
    try {
      const result = await runOperationWithLock(operationLock.current, setOperationPending, () => {
        setMessage("");
        return logoutAccountDevices({
          fetcher: fetch,
          accountId: account.id,
          accountName: account.name,
          confirm: () => true,
          refresh: () => isActive(generation) ? load() : Promise.resolve(false),
        });
      });
      if (result.started && result.value && isActive(generation)) setMessage(result.value);
    } catch (error) {
      if (isActive(generation)) setMessage(errorMessage(error, "全部设备下线失败"));
    }
  }

  return (
    <>
      <Button onClick={openDialog} size="sm" type="button" variant="outline">登录设备</Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <DialogHeader>
              <DialogTitle>{account.name} · 登录设备</DialogTitle>
              <DialogDescription>查看最近 90 天登录设备，调整该账号上限，或让指定设备退出。</DialogDescription>
            </DialogHeader>
            <Button disabled={pending} onClick={() => changeOpen(false)} size="sm" type="button" variant="outline">关闭</Button>
          </div>

          {message && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
          {pending && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">正在处理，操作完成后可关闭。</p>}
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-500">正在加载设备信息…</p> : null}

          {data && (
            <div className="space-y-6">
              <section className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">账号设备上限</h3>
                    <p className="mt-1 text-sm text-slate-500">输入 1–20；留空表示继承全局默认值。</p>
                  </div>
                  <Button onClick={restoreDefaults} disabled={pending} size="sm" type="button" variant="outline">恢复全局默认</Button>
                </div>
                <div className="mt-4">
                  <DeviceLimitFields
                    disabled={pending}
                    draft={draft}
                    effective={data.effectivePolicy}
                    mode="account"
                    onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
                  />
                </div>
                <Button className="mt-4" disabled={pending} onClick={saveOverride} type="button">
                  {pending ? "处理中…" : "保存账号上限"}
                </Button>
              </section>

              <DeviceRecordList
                accountIdentifier={data.account.phone || data.account.email || "未设置登录账号"}
                devices={data.devices}
                onLogoutAll={logoutAll}
                onLogoutDevice={logoutDevice}
                pending={pending}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
