"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children, initialRole }: { children: React.ReactNode; initialRole: string | null }) {
  const pathname = usePathname();
  const isFullScreenRoute = pathname === "/" || pathname.startsWith("/materials") || pathname.startsWith("/login") || pathname.startsWith("/teacher-login-2026") || pathname.startsWith("/parent");

  return (
    <body className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar initialRole={initialRole} />
        <main className={cn("flex-1 overflow-auto bg-slate-50", isFullScreenRoute ? "p-0" : "p-6")}>
          {children}
        </main>
      </div>
    </body>
  );
}
