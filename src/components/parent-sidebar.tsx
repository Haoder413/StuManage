"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const parentNavItems = [
  { href: "/parent", label: "孩子首页", icon: "👧" },
  { href: "/parent/lessons", label: "时间管理", icon: "📅" },
  { href: "/parent/exams", label: "成绩记录", icon: "📝" },
  { href: "/parent/progress", label: "学习进度", icon: "📈" },
  { href: "/parent/resources", label: "资料中心", icon: "📁" },
  { href: "/parent/settings", label: "账号设置", icon: "⚙" },
];

export function ParentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar sticky top-0 flex min-h-screen w-48 shrink-0 flex-col">
      <div className="px-4 pb-3 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          <span className="text-sky-500">家</span>长端
        </h1>
      </div>

      <div className="px-4 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">导航</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {parentNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "border border-sky-500/15 bg-sky-500/10 text-sky-600"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-2 pb-4">
        <LogoutButton className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600" />
      </div>
    </aside>
  );
}
