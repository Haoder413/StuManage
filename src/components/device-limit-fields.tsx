import React from "react";
import { Input } from "@/components/ui/input";
import {
  DEVICE_LIMIT_GROUPS,
  type DeviceLimitDraft,
} from "@/lib/device-admin-client";
import type { DeviceLimits } from "@/lib/device-session-policy";

export function DeviceLimitFields({
  draft,
  disabled,
  effective,
  mode,
  onChange,
}: {
  draft: DeviceLimitDraft;
  disabled: boolean;
  effective?: DeviceLimits;
  mode: "account" | "global";
  onChange: (key: keyof DeviceLimitDraft, value: string) => void;
}) {
  return (
    <div className={`grid gap-4 ${mode === "account" ? "md:grid-cols-2" : "sm:grid-cols-2"}`}>
      {DEVICE_LIMIT_GROUPS.map((group) => (
        <div key={group.channel} className="rounded-md border bg-slate-50 p-3">
          <p className="mb-3 text-sm font-semibold text-slate-800">{group.title}</p>
          <div className="grid grid-cols-3 gap-2">
            {group.fields.map((field) => (
              <label key={field.key} className="text-xs text-slate-600">
                {field.label}
                <Input
                  aria-label={`${group.title}${field.label}${mode === "account" ? "账号" : "全局"}上限`}
                  className="mt-1 bg-white"
                  disabled={disabled}
                  inputMode="numeric"
                  max={20}
                  min={1}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  placeholder={mode === "account" && effective ? `继承 ${effective[field.key]}` : undefined}
                  type="number"
                  value={draft[field.key]}
                />
                {mode === "account" && effective && (
                  <span className="mt-1 block text-slate-400">当前有效：{effective[field.key]} 台</span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
