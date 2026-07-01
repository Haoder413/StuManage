import Link from "next/link";
import { SiteDisclaimer } from "@/components/site-disclaimer";

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6">
        <header className="rounded-lg border bg-white px-5 py-4 shadow-sm">
          <nav aria-label="主菜单">
            <Link
              href="/materials"
              className="inline-flex rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              资料中心
            </Link>
          </nav>
        </header>

        <SiteDisclaimer />
      </div>
    </main>
  );
}
