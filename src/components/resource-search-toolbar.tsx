"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CourseOption, WorkspaceOption } from "@/types/resource-library";

export function ResourceSearchToolbar({
  role,
  courses,
  workspaces,
}: {
  role: string;
  courses: CourseOption[];
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  function replaceParams(update: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(update)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query !== (searchParams.get("q") || "")) replaceParams({ q: query });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query, searchParams]);

  const selectedWorkspace = searchParams.get("workspaceId") || "all";
  const visibleCourses = role === "admin" && selectedWorkspace !== "all"
    ? courses.filter((course) => course.workspaceId === selectedWorkspace)
    : courses;
  const activeFilters = ["q", "grade", "year", "subject", "resourceKind", "fileState", "courseId", "workspaceId"].filter((key) => searchParams.get(key)).length;
  const years = Array.from({ length: 2100 - 1900 + 1 }, (_, index) => 2100 - index);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(110px,150px))]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、原文件名、标签、年级或科目" />
        <Select value={searchParams.get("grade") || "all"} onValueChange={(value) => replaceParams({ grade: value })}>
          <SelectTrigger><SelectValue placeholder="全部年级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部年级</SelectItem>
            {["小一", "小二", "小三", "小四", "小五", "小六", "初一", "初二", "初三", "高一", "高二", "高三"].map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("year") || "all"} onValueChange={(value) => replaceParams({ year: value })}>
          <SelectTrigger><SelectValue placeholder="全部年份" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部年份</SelectItem>
            <SelectItem value="unset">未设置年份</SelectItem>
            {years.map((year) => <SelectItem key={year} value={String(year)}>{year}年</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("subject") || "all"} onValueChange={(value) => replaceParams({ subject: value })}>
          <SelectTrigger><SelectValue placeholder="全部科目" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部科目</SelectItem>
            {["数学", "语文", "英语", "物理", "化学"].map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("resourceKind") || "all"} onValueChange={(value) => replaceParams({ resourceKind: value })}>
          <SelectTrigger><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="paper">试卷</SelectItem>
            <SelectItem value="animation">动画</SelectItem>
            <SelectItem value="material">普通资料</SelectItem>
          </SelectContent>
        </Select>
        <Select value={searchParams.get("fileState") || "all"} onValueChange={(value) => replaceParams({ fileState: value })}>
          <SelectTrigger><SelectValue placeholder="全部版本" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部版本</SelectItem>
            <SelectItem value="complete">学生版＋答案版</SelectItem>
            <SelectItem value="student">含学生版</SelectItem>
            <SelectItem value="answer">含答案版</SelectItem>
            <SelectItem value="incomplete">版本待补充</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {role === "admin" && workspaces.length > 0 && (
          <Select value={selectedWorkspace} onValueChange={(value) => replaceParams({ workspaceId: value, courseId: "" })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="全部工作区" /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部工作区</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={searchParams.get("courseId") || "all"} onValueChange={(value) => replaceParams({ courseId: value })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="全部课程" /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部课程</SelectItem>{visibleCourses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={searchParams.get("sort") || "updated"} onValueChange={(value) => replaceParams({ sort: value })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">最近更新</SelectItem>
            <SelectItem value="created">最近上传</SelectItem>
            <SelectItem value="title">标题排序</SelectItem>
            <SelectItem value="grade">年级排序</SelectItem>
            <SelectItem value="size">文件大小</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); router.replace(pathname, { scroll: false }); }}>全部清除（{activeFilters}）</Button>}
      </div>
    </div>
  );
}
