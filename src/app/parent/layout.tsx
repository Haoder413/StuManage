import { ParentSidebar } from "@/components/parent-sidebar";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <ParentSidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
