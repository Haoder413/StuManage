import { SiteDisclaimer } from "@/components/site-disclaimer";

export const metadata = {
  title: "免责声明 - 学生管理系统",
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
