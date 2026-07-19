"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEVICE_LIMIT_GROUPS,
  forceLogoutAll,
  forceLogoutDevice,
  getAccountDevices,
  limitsToDraft,
  parseOverrideLimitDraft,
  saveAccountOverride,
  type AccountDevicesResponse,
  type DeviceLimitDraft,
} from "@/lib/device-admin-client";

type AccountSummary = { id: string; name: string };

export function AccountDeviceDialog({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AccountDevicesResponse | null>(null);
  const [draft, setDraft] = useState<DeviceLimitDraft>(() => limitsToDraft(null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const next = await getAccountDevices(fetch, account.id);
      setData(next);
      setDraft(limitsToDraft(next.override));
      return true;
    } catch (error) {
      setData(null);
      setMessage(errorMessage(error, "加载设备失败"));
      return false;
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setOpen(true);
    void load();
  }

  async function saveOverride() {
    setMessage("");
    let parsed;
    try {
      parsed = parseOverrideLimitDraft(draft);
    } catch (error) {
      setMessage(errorMessage(error, "请检查设备上限"));
      return;
    }
    setSaving(true);
    try {
      await saveAccountOverride(fetch, account.id, parsed);
      if (await load()) setMessage("已保存该账号的设备上限");
    } catch (error) {
      setMessage(errorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    const emptyDraft = limitsToDraft(null);
    setDraft(emptyDraft);
    setSaving(true);
    setMessage("");
    try {
      await saveAccountOverride(fetch, account.id, parseOverrideLimitDraft(emptyDraft));
      if (await load()) setMessage("已恢复使用全局默认上限");
    } catch (error) {
      setMessage(errorMessage(error, "恢复失败"));
    } finally {
      setSaving(false);
    }
  }

  async function logoutDevice(deviceId: string, displayName: string) {
    if (!window.confirm(`确认让“${displayName}”退出登录？该设备需要重新输入账号密码。`)) return;
    setMessage("");
    try {
      const result = await forceLogoutDevice(fetch, account.id, deviceId);
      if (await load()) {
        setMessage(result.deletedSessions > 0 ? "该设备已强制下线" : "该设备当前没有有效登录");
      }
    } catch (error) {
      setMessage(errorMessage(error, "设备下线失败"));
    }
  }

  async function logoutAll() {
    if (!window.confirm(`确认让“${account.name}”的所有设备退出登录？网页端和小程序都需要重新登录。`)) return;
    setMessage("");
    try {
      const result = await forceLogoutAll(fetch, account.id);
      if (await load()) {
        setMessage(result.deletedSessions > 0 ? `已退出 ${result.deletedSessions} 个有效登录` : "该账号当前没有有效登录");
      }
    } catch (error) {
      setMessage(errorMessage(error, "全部设备下线失败"));
    }
  }

  return (
    <>
      <Button onClick={openDialog} size="sm" type="button" variant="outline">登录设备</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{account.name} · 登录设备</DialogTitle>
            <DialogDescription>查看最近 90 天登录设备，调整该账号上限，或让指定设备退出。</DialogDescription>
          </DialogHeader>

          {message && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-500">正在加载设备信息…</p> : null}

          {data && (
            <div className="space-y-6">
              <section className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">账号设备上限</h3>
                    <p className="mt-1 text-sm text-slate-500">输入 1–20；留空表示继承全局默认值。</p>
                  </div>
                  <Button onClick={restoreDefaults} disabled={saving} size="sm" type="button" variant="outline">恢复全局默认</Button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {DEVICE_LIMIT_GROUPS.map((group) => (
                    <div key={group.channel} className="rounded-md bg-slate-50 p-3">
                      <p className="mb-3 text-sm font-semibold text-slate-800">{group.title}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.fields.map((field) => (
                          <label key={field.key} className="text-xs text-slate-600">
                            {field.label}
                            <Input
                              aria-label={`${group.title}${field.label}账号上限`}
                              className="mt-1 bg-white"
                              inputMode="numeric"
                              max={20}
                              min={1}
                              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              placeholder={`继承 ${data.effectivePolicy[field.key]}`}
                              type="number"
                              value={draft[field.key]}
                            />
                            <span className="mt-1 block text-slate-400">当前有效：{data.effectivePolicy[field.key]} 台</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="mt-4" disabled={saving} onClick={saveOverride} type="button">
                  {saving ? "保存中…" : "保存账号上限"}
                </Button>
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">设备记录</h3>
                    <p className="mt-1 text-sm text-slate-500">{data.account.phone || data.account.email || "未设置登录账号"}</p>
                  </div>
                  <Button disabled={!data.devices.some((device) => device.activeSessionCount > 0)} onClick={logoutAll} type="button" variant="destructive">
                    全部设备下线
                  </Button>
                </div>

                {data.devices.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed py-8 text-center text-sm text-slate-400">最近 90 天暂无登录设备</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {data.devices.map((device) => (
                      <article key={device.id} className="rounded-lg border bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{device.displayName || "未命名设备"}</p>
                              <Badge>{channelLabel(device.channel)}</Badge>
                              <Badge>{deviceTypeLabel(device.deviceType)}</Badge>
                              <span className={device.activeSessionCount > 0 ? "text-xs font-medium text-emerald-600" : "text-xs text-slate-400"}>
                                {device.activeSessionCount > 0 ? `在线 · ${device.activeSessionCount} 个会话` : "已退出"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {[device.operatingSystem, device.browser].filter(Boolean).join(" · ") || "系统与浏览器未知"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">IP：{device.lastIpAddress || "未记录"}</p>
                          </div>
                          <Button
                            disabled={device.activeSessionCount === 0}
                            onClick={() => logoutDevice(device.id, device.displayName || "未命名设备")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            强制下线
                          </Button>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs sm:grid-cols-4">
                          <TimeItem label="首次登录" value={device.firstSeenAt} />
                          <TimeItem label="最近登录" value={device.lastLoginAt} />
                          <TimeItem label="最近活跃" value={device.lastSeenAt} />
                          <TimeItem label="最近退出" value={device.lastLogoutAt} />
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{children}</span>;
}

function TimeItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-600">{formatDate(value)}</dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

function channelLabel(channel: string) {
  return channel === "miniProgram" ? "小程序" : "网页端";
}

function deviceTypeLabel(deviceType: string) {
  if (deviceType === "mobile") return "手机";
  if (deviceType === "tablet") return "平板";
  return "电脑";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
