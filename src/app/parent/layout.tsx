import { ParentSidebar } from "@/components/parent-sidebar";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ParentSidebar />
      <main className="min-w-0 p-4 pb-20 md:ml-48 md:min-h-screen md:p-6 md:pb-6">{children}</main>
    </div>
  );
}
