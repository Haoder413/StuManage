import React from "react";
import { Button } from "@/components/ui/button";
import type { AccountDevice } from "@/lib/device-admin-client";
import { deviceListKind } from "@/lib/device-admin-ui-state";

export function DeviceRecordList({
  accountIdentifier,
  devices,
  onLogoutAll,
  onLogoutDevice,
  pending,
}: {
  accountIdentifier: string;
  devices: AccountDevice[];
  onLogoutAll: () => void;
  onLogoutDevice: (deviceId: string, displayName: string) => void;
  pending: boolean;
}) {
  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">设备记录</h3>
          <p className="mt-1 text-sm text-slate-500">{accountIdentifier}</p>
        </div>
        <Button disabled={pending || !devices.some((device) => device.activeSessionCount > 0)} onClick={onLogoutAll} type="button" variant="destructive">
          全部设备下线
        </Button>
      </div>

      {deviceListKind(devices) === "empty" ? (
        <p className="mt-4 rounded-lg border border-dashed py-8 text-center text-sm text-slate-400">最近 90 天暂无登录设备</p>
      ) : (
        <div className="mt-4 space-y-3">
          {devices.map((device) => (
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
                  disabled={pending || device.activeSessionCount === 0}
                  onClick={() => onLogoutDevice(device.id, device.displayName || "未命名设备")}
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
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

function channelLabel(channel: string) {
  return channel === "miniProgram" ? "小程序" : "网页端";
}

function deviceTypeLabel(deviceType: string) {
  if (deviceType === "mobile") return "手机";
  if (deviceType === "tablet") return "平板";
  return "电脑";
}
