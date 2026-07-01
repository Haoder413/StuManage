"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: "📊" },
  { href: "/students", label: "学生管理", icon: "👤" },
  { href: "/courses", label: "课程管理", icon: "📚" },
  { href: "/exams", label: "成绩管理", icon: "📝" },
  { href: "/progress", label: "学习进度", icon: "📈" },
  { href: "/schedule", label: "排课考勤", icon: "📅" },
  { href: "/resources", label: "资料中心", icon: "📁" },
  { href: "/homework", label: "作业批改", icon: "✍" },
  { href: "/accounts", label: "账号与学习关系", icon: "🔐", adminOnly: true },
];

const bottomItems = [
  { href: "/reports", label: "报表导出", icon: "📋" },
  { href: "/communication", label: "沟通记录", icon: "💬" },
  { href: "/settings", label: "系统设置", icon: "⚙" },
];

export function Sidebar({ initialRole }: { initialRole: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(initialRole);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    fetch("/api/account/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.role) setRole(data.role);
      })
      .catch(() => {});
  }, []);

  if (pathname === "/" || pathname.startsWith("/materials") || pathname.startsWith("/login") || pathname.startsWith("/teacher-login-2026") || pathname.startsWith("/parent")) return null;

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json();
    router.replace(data.redirectTo || "/");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "glass-sidebar flex flex-col shrink-0 sticky top-0",
        collapsed ? "w-[68px]" : "w-48"
      )}
    >
      {/* Logo */}
      <div className={cn("px-4 pt-6 pb-3 flex items-center", collapsed ? "justify-center" : "")}>
        <h1 className="text-xl font-bold tracking-tight text-gray-900 whitespace-nowrap flex items-center gap-1.5">
          <span className="text-sky-500">学</span>
          <span className={cn("transition-all duration-200", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100")}>管</span>
        </h1>
      </div>

      {/* Section label */}
      <div className={cn("px-4 mb-1", collapsed ? "hidden" : "")}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">导航</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.filter((item) => !item.adminOnly || role === "admin").map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-sky-500/10 text-sky-600 border border-sky-500/15"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className={cn(
                "transition-all duration-200",
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className={cn("space-y-0.5 border-t border-gray-100 pt-3", collapsed ? "px-2 pb-4" : "px-2 pb-4")}>
        <div className={cn("px-4 mb-1", collapsed ? "hidden" : "")}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">其他</p>
        </div>
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-sky-500/10 text-sky-600 border border-sky-500/15"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className={cn(
                "transition-all duration-200",
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}>{item.label}</span>
            </Link>
          );
        })}

        {/* Toggle button */}
        <button
          onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 w-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 mt-2"
          title={collapsed ? "退出登录" : undefined}
        >
          <span className="text-base shrink-0">↪</span>
          <span className={cn(
            "transition-all duration-200",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}>退出</span>
        </button>

        <button
          onClick={toggleCollapse}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 w-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 mt-2"
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          <span className={cn(
            "text-base shrink-0 transition-transform duration-300 block text-center",
            collapsed ? "" : "rotate-180"
          )}>
            ◀
          </span>
          <span className={cn(
            "transition-all duration-200",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}>收起</span>
        </button>
      </div>
    </aside>
  );
}
