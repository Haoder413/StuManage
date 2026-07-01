"use client";

import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteDisclaimer } from "@/components/site-disclaimer";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const result = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(result.error || "登录失败");
      return;
    }

    const next = searchParams.get("next");
    router.replace(next && result.redirectTo !== "/parent" ? next : result.redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
        <form onSubmit={handleSubmit} className="w-full rounded-lg border bg-white p-6 shadow-sm lg:max-w-sm">
          <h1 className="text-xl font-bold text-slate-900">登录</h1>
          <p className="mt-1 text-sm text-slate-500">使用老师、家长或演示账号进入系统</p>

          <label className="mt-6 block text-sm font-medium text-slate-700">
            账号
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              placeholder="teacher / parent / demo"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            密码
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              type="password"
              placeholder="请输入密码"
            />
          </label>

          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "登录中..." : "登录"}
          </button>
          <a className="mt-4 block text-center text-xs font-semibold text-sky-600" href="/disclaimer">查看网站免责声明</a>
        </form>
        <div className="w-full lg:max-w-xl">
          <SiteDisclaimer compact />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
