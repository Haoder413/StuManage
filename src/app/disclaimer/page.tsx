import { SiteDisclaimer } from "@/components/site-disclaimer";

export const metadata = {
  title: "免责声明 - 个人学习分享博客",
};

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <SiteDisclaimer />
      </div>
    </main>
  );
}
