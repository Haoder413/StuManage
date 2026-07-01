import { SiteDisclaimer } from "@/components/site-disclaimer";

export const metadata = {
  title: "资料中心 - 个人学习分享博客",
};

export default function PublicMaterialsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-lg border bg-white px-5 py-4 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">资料中心</h1>
        </header>
        <SiteDisclaimer />
      </div>
    </main>
  );
}
