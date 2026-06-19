"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreenRoute = pathname.startsWith("/login") || pathname.startsWith("/parent");

  return (
    <body className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className={cn("flex-1 overflow-auto bg-slate-50", isFullScreenRoute ? "p-0" : "p-6")}>
          {children}
        </main>
      </div>
    </body>
  );
}
