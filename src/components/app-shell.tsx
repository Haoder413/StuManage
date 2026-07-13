"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

function normalizePath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isHiddenLoginRoute(pathname: string, hiddenLoginPath: string) {
  return normalizePath(pathname) === normalizePath(hiddenLoginPath);
}

export function AppShell({
  children,
  initialRole,
  hiddenLoginPath,
}: {
  children: React.ReactNode;
  initialRole: string | null;
  hiddenLoginPath: string;
}) {
  const pathname = usePathname();
  const isFullScreenRoute = !initialRole || pathname === "/" || pathname.startsWith("/materials") || pathname.startsWith("/login") || isHiddenLoginRoute(pathname, hiddenLoginPath) || pathname.startsWith("/parent") || pathname.startsWith("/reports/students/");

  return (
    <body className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar initialRole={initialRole} hiddenLoginPath={hiddenLoginPath} />
        <main className={cn("flex-1 overflow-auto bg-slate-50", isFullScreenRoute ? "p-0" : "p-6")}>
          {children}
        </main>
      </div>
    </body>
  );
}
