"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceLimitFields } from "@/components/device-limit-fields";
import {
  limitsToDraft,
  type DeviceLimitDraft,
} from "@/lib/device-admin-client";
import {
  createOperationLock,
  loadGlobalPolicyPanel,
  runOperationWithLock,
  saveGlobalPolicyDraft,
} from "@/lib/device-admin-ui-state";

export function DevicePolicyCard() {
  const [draft, setDraft] = useState<DeviceLimitDraft>(() => limitsToDraft(null));
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const operationLock = useRef(createOperationLock());
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void loadGlobalPolicyPanel(fetch, (state) => {
      if (!active) return;
      if (state.phase === "loading") {
        setLoading(true);
        return;
      }
      setLoading(false);
      if (state.phase === "error") {
        setMessage(state.message);
        return;
      }
      setDraft(limitsToDraft(state.data));
    });
    return () => { active = false; mounted.current = false; };
  }, []);

  async function save() {
    try {
      const result = await runOperationWithLock(
        operationLock.current,
        (value) => { if (mounted.current) setPending(value); },
        () => {
          setMessage("");
          return saveGlobalPolicyDraft(fetch, draft);
        },
      );
      if (result.started && mounted.current) {
        setDraft(limitsToDraft(result.value.data));
        setMessage(result.value.message);
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : "保存失败");
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
            <DeviceLimitFields
              disabled={pending}
              draft={draft}
              mode="global"
              onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
            {message && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
            <Button disabled={pending} onClick={save} type="button">{pending ? "保存中…" : "保存设备上限"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
