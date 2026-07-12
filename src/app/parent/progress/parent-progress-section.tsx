"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function ParentProgressSection({
  title,
  count,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
            {open ? "▾" : "▸"}
          </span>
          <span className="truncate text-lg font-semibold text-slate-900">{title}</span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
          )}
        </span>
        {summary && <span className="flex min-w-20 flex-1 items-center">{summary}</span>}
        <span className="shrink-0 text-xs font-semibold text-slate-400">{open ? "收起" : "展开"}</span>
      </button>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}
