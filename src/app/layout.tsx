import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人学习分享博客",
  description: "个人学习分享博客与资料中心",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <AppShell initialRole={user?.role || null}>{children}</AppShell>
    </html>
  );
}
