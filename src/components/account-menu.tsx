"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronUp, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountProfile = {
  name: string;
  role: string;
};

type AccountMenuVariant = "desktop" | "collapsed" | "mobile";

const roleLabels: Record<string, string> = {
  admin: "管理员",
  teacher: "教师账号",
  parent: "家长账号",
  demo: "演示账号",
};

const accountTriggerFocus = "focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";

export function AccountMenu({
  settingsHref,
  role,
  active = false,
  variant = "desktop",
}: {
  settingsHref: string;
  role: string;
  active?: boolean;
  variant?: AccountMenuVariant;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile>({ name: "个人中心", role });
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    fetch("/api/account/me")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.name && data?.role) setProfile({ name: data.name, role: data.role });
      })
      .catch(() => {});
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLogoutError("退出失败，请重试");
        return;
      }
      const data = await response.json();
      router.replace(data.redirectTo || "/");
      router.refresh();
    } catch {
      setLogoutError("退出失败，请重试");
    } finally {
      setLoggingOut(false);
    }
  }

  const side = variant === "collapsed" ? "right" : "top";
  const align = variant === "mobile" ? "end" : "start";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {variant === "mobile" ? (
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors outline-none",
              accountTriggerFocus,
              active ? "bg-sky-50 text-sky-600" : "text-gray-500",
            )}
            aria-label="打开个人中心菜单"
          >
            <UserRound className="h-4 w-4" />
            <span>我的</span>
          </button>
        ) : variant === "collapsed" ? (
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-lg text-gray-500 transition-colors outline-none hover:bg-gray-100 hover:text-gray-700",
              accountTriggerFocus,
              active && "bg-sky-500/10 text-sky-600",
            )}
            title="个人中心"
            aria-label="打开个人中心菜单"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <UserRound className="h-4 w-4" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-gray-100",
              accountTriggerFocus,
              active && "bg-sky-500/10",
            )}
            aria-label="打开个人中心菜单"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-700">{profile.name}</span>
              <span className="block truncate text-[10px] text-gray-400">{roleLabels[profile.role] || "个人账号"}</span>
            </span>
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          sideOffset={8}
          className="z-[70] min-w-48 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          <DropdownMenu.Label className="px-2.5 py-2">
            <p className="max-w-44 truncate text-sm font-semibold text-gray-800">{profile.name}</p>
            <p className="mt-0.5 text-xs text-gray-400">{roleLabels[profile.role] || "个人账号"}</p>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
          <DropdownMenu.Item asChild>
            <Link
              href={settingsHref}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 outline-none transition-colors focus:bg-sky-50 focus:text-sky-700"
            >
              <Settings className="h-4 w-4" />
              <span>个人设置</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={loggingOut}
            onSelect={(event) => {
              event.preventDefault();
              void logout();
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-500 outline-none transition-colors focus:bg-red-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>{loggingOut ? "正在退出..." : "退出登录"}</span>
          </DropdownMenu.Item>
          {logoutError && <p className="px-2.5 py-1.5 text-xs text-red-500" role="alert">{logoutError}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
