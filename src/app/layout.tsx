import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "学管 - 学生管理系统",
  description: "数学补习班学生管理系统",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <AppShell initialRole={user?.role || null}>{children}</AppShell>
    </html>
  );
}
