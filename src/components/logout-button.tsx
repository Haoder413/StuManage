"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json();
    router.replace(data.redirectTo || "/login");
    router.refresh();
  }

  return (
    <button onClick={logout} className={className} type="button">
      退出
    </button>
  );
}
