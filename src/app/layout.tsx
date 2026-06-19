import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "学管 - 学生管理系统",
  description: "数学补习班学生管理系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <AppShell>{children}</AppShell>
    </html>
  );
}
