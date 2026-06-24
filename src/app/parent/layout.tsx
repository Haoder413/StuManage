import { ParentSidebar } from "@/components/parent-sidebar";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <ParentSidebar />
      <main className="min-w-0 flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
    </div>
  );
}
