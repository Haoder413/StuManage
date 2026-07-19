"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEVICE_LIMIT_GROUPS,
  getDevicePolicy,
  limitsToDraft,
  parseGlobalLimitDraft,
  saveDevicePolicy,
  type DeviceLimitDraft,
} from "@/lib/device-admin-client";

export function DevicePolicyCard() {
  const [draft, setDraft] = useState<DeviceLimitDraft>(() => limitsToDraft(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getDevicePolicy(fetch)
      .then((policy) => {
        if (active) setDraft(limitsToDraft(policy));
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "加载设备上限失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save() {
    setMessage("");
    let parsed;
    try {
      parsed = parseGlobalLimitDraft(draft);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请检查设备上限");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDevicePolicy(fetch, parsed);
      setDraft(limitsToDraft(saved));
      setMessage("已保存全局设备上限");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录设备上限</CardTitle>
        <p className="text-sm text-slate-500">同一账号在每个渠道、每类设备可同时登录的数量。单账号可在账号管理中单独设置。</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">正在加载设备上限…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {DEVICE_LIMIT_GROUPS.map((group) => (
                <div key={group.channel} className="rounded-lg border bg-slate-50 p-3">
                  <p className="mb-3 text-sm font-semibold text-slate-800">{group.title}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.fields.map((field) => (
                      <label key={field.key} className="text-xs text-slate-600">
                        {field.label}
                        <Input
                          aria-label={`${group.title}${field.label}全局上限`}
                          className="mt-1 bg-white"
                          inputMode="numeric"
                          max={20}
                          min={1}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                          type="number"
                          value={draft[field.key]}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {message && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
            <Button disabled={saving} onClick={save} type="button">{saving ? "保存中…" : "保存设备上限"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
