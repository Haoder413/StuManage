"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CourseOption } from "@/types/resource-library";

export type EditableUploadGroup = {
  groupKey: string;
  title: string;
  grade: string | null;
  subject: string | null;
  resourceKind: "paper" | "animation" | "material";
  tags: string[];
  confidence: number;
  needsConfirmation: boolean;
  reason: string;
  courseIds: string[];
  files: Array<{ originalName: string; role: "student" | "answer" | "supplement" }>;
};

export function ResourceGroupEditor({
  group,
  courses,
  onChange,
  onSplit,
  onMergePrevious,
}: {
  group: EditableUploadGroup;
  courses: CourseOption[];
  onChange: (group: EditableUploadGroup) => void;
  onSplit: (fileIndex: number) => void;
  onMergePrevious?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{group.title}</p>
          <p className="text-xs text-slate-500">{group.reason}</p>
        </div>
        {group.needsConfirmation && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">请确认配对</span>}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <Input value={group.title} onChange={(event) => onChange({ ...group, title: event.target.value })} placeholder="规范标题" className="md:col-span-2" />
        <Input value={group.grade || ""} onChange={(event) => onChange({ ...group, grade: event.target.value || null })} placeholder="年级" />
        <Input value={group.subject || ""} onChange={(event) => onChange({ ...group, subject: event.target.value || null })} placeholder="科目" />
        <Select value={group.resourceKind} onValueChange={(value) => onChange({ ...group, resourceKind: value as EditableUploadGroup["resourceKind"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paper">试卷</SelectItem>
            <SelectItem value="animation">动画</SelectItem>
            <SelectItem value="material">普通资料</SelectItem>
          </SelectContent>
        </Select>
        <Input value={group.tags.join("，")} onChange={(event) => onChange({ ...group, tags: event.target.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean) })} placeholder="标签，用逗号分隔" className="md:col-span-3" />
      </div>
      <div className="space-y-2">
        {group.files.map((file, fileIndex) => (
          <div key={`${file.originalName}-${fileIndex}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-700">{file.originalName}</span>
            <Select value={file.role} onValueChange={(value) => {
              const files = group.files.map((item, index) => index === fileIndex ? { ...item, role: value as typeof item.role } : item);
              onChange({ ...group, files });
            }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">学生版</SelectItem>
                <SelectItem value="answer">答案版</SelectItem>
                <SelectItem value="supplement">补充资料</SelectItem>
              </SelectContent>
            </Select>
            {group.files.length > 1 && <button type="button" className="text-xs font-semibold text-sky-600" onClick={() => onSplit(fileIndex)}>拆分</button>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {courses.map((course) => (
          <label key={course.id} className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={group.courseIds.includes(course.id)} onChange={(event) => onChange({
              ...group,
              courseIds: event.target.checked ? [...group.courseIds, course.id] : group.courseIds.filter((id) => id !== course.id),
            })} />
            {course.name}
          </label>
        ))}
      </div>
      {onMergePrevious && <button type="button" className="text-xs font-semibold text-sky-600" onClick={onMergePrevious}>与上一组合并</button>}
    </div>
  );
}
