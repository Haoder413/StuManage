import { requireParent } from "@/lib/auth";
import { getParentStudents, parseTags } from "@/lib/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParentLessonsPage() {
  const user = await requireParent();
  const parentStudents = await getParentStudents(user);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">上课记录</h1>
        <p className="mt-1 text-sm text-slate-500">查看每次课的状态、课堂内容和老师反馈</p>
      </div>

      <div className="space-y-4">
        {parentStudents.flatMap(({ student }) => student.attendance.map((item) => {
          const contentTags = parseTags(item.contentTags);
          const feedbackTags = parseTags(item.feedbackTags);
          const weakPointTags = parseTags(item.weakPointTags);
          return (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{student.name} · {item.date.toLocaleDateString("zh-CN")} · {statusLabel(item.status)}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <p className="mb-2 font-semibold text-slate-700">上课内容</p>
                  <p className="text-slate-600">{item.lessonContent || "暂无文字记录"}</p>
                  <TagList tags={contentTags} />
                </div>
                <div>
                  <p className="mb-2 font-semibold text-slate-700">上课反馈</p>
                  <p className="text-slate-600">{item.lessonFeedback || "暂无文字记录"}</p>
                  <TagList tags={feedbackTags} />
                </div>
                <div>
                  <p className="mb-2 font-semibold text-slate-700">薄弱点</p>
                  <TagList tags={weakPointTags} emptyText="暂无关联薄弱点" />
                </div>
              </CardContent>
            </Card>
          );
        }))}
      </div>
    </div>
  );
}

function TagList({ tags, emptyText = "暂无标签" }: { tags: string[]; emptyText?: string }) {
  if (tags.length === 0) return <p className="text-slate-400">{emptyText}</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "present") return "出勤";
  if (status === "makeup") return "补课";
  return "请假";
}
