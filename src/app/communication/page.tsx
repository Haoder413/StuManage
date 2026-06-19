import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeacherLike } from "@/lib/auth";

export default async function CommunicationPage() {
  const user = await requireTeacherLike();
  const students = await prisma.student.findMany({
    where: { workspaceId: user.workspaceId },
    include: { communicationLogs: { orderBy: { date: "desc" }, take: 5 } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="沟通记录" description="查看和管理与家长的沟通历史" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {students.map((s) => (
          <Link key={s.id} href={`/communication/students/${s.id}`}>
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:translate-y-[-2px]">
              <CardHeader className="p-4"><CardTitle className="!text-base">{s.name}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                {s.communicationLogs.length === 0 ? (
                  <p className="text-sm text-[#1a1a2e]/30">暂无沟通记录</p>
                ) : (
                  <div className="space-y-2">
                    {s.communicationLogs.map((log) => (
                      <div key={log.id} className="text-sm border-b border-[#1a1a2e]/5 pb-1 last:border-0">
                        <span className="text-xs text-[#1a1a2e]/40">{log.date.toLocaleDateString("zh-CN")} · {log.method}</span>
                        <p className="text-[#1a1a2e]/70 truncate">{log.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
