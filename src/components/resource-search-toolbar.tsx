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
  const currentYear = searchParams.get("year") || "";
  const [yearInput, setYearInput] = useState(currentYear === "unset" ? "" : currentYear);
  const [yearError, setYearError] = useState("");
  const [yearEditing, setYearEditing] = useState(false);

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

  useEffect(() => {
    setYearInput(currentYear === "unset" ? "" : currentYear);
    setYearError("");
    setYearEditing(false);
  }, [currentYear]);

  useEffect(() => {
    if (!yearEditing) return;
    const timer = window.setTimeout(() => {
      const value = yearInput.trim();
      if (!value) {
        setYearError("");
        setYearEditing(false);
        replaceParams({ year: "" });
        return;
      }
      const year = Number(value);
      if (!/^\d{4}$/.test(value) || year < 1900 || year > 2100) {
        setYearError("请输入 1900—2100 的年份");
        return;
      }
      setYearError("");
      setYearEditing(false);
      replaceParams({ year: value });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [yearEditing, yearInput, searchParams]);

  const selectedWorkspace = searchParams.get("workspaceId") || "all";
  const visibleCourses = role === "admin" && selectedWorkspace !== "all"
    ? courses.filter((course) => course.workspaceId === selectedWorkspace)
    : courses;
  const activeFilters = ["q", "grade", "year", "subject", "resourceKind", "fileState", "courseId", "workspaceId"].filter((key) => searchParams.get(key)).length;
  const yearIsUnset = currentYear === "unset";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(110px,150px))]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、原文件名、标签、年级或科目" />
        <Select value={searchParams.get("grade") || "all"} onValueChange={(value) => replaceParams({ grade: value })}>
          <SelectTrigger><SelectValue placeholder="全部年级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部年级</SelectItem>
            {["初一", "初二", "初三"].map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
          </SelectContent>
        </Select>
        <div>
          <Input
            type="number"
            min="1900"
            max="2100"
            inputMode="numeric"
            value={yearInput}
            onChange={(event) => {
              setYearInput(event.target.value);
              setYearError("");
              setYearEditing(true);
            }}
            placeholder={yearIsUnset ? "未设置年份" : "全部年份"}
            aria-invalid={Boolean(yearError)}
            aria-describedby={yearError ? "resource-year-error" : undefined}
          />
          {yearError && <p id="resource-year-error" className="mt-1 text-xs text-red-600">{yearError}</p>}
        </div>
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
        <Button
          type="button"
          variant={yearIsUnset ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setYearInput("");
            setYearError("");
            setYearEditing(false);
            if (yearIsUnset) replaceParams({ year: "" });
            else replaceParams({ year: "unset" });
          }}
        >
          {yearIsUnset ? "全部年份" : "未设置年份"}
        </Button>
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
        {activeFilters > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); setYearInput(""); setYearError(""); setYearEditing(false); router.replace(pathname, { scroll: false }); }}>全部清除（{activeFilters}）</Button>}
      </div>
    </div>
  );
}
