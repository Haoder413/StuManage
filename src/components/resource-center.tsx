"use client";

import { Suspense, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResourceGroupList } from "@/components/resource-group-list";
import { ResourceSearchToolbar } from "@/components/resource-search-toolbar";
import { ResourceUploadWizard } from "@/components/resource-upload-wizard";
import type { CourseOption, WorkspaceOption } from "@/types/resource-library";

export function ResourceCenter({
  role,
  workspaces = [],
  courses = [],
}: {
  role: string;
  workspaces?: WorkspaceOption[];
  courses?: CourseOption[];
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const canUpload = role === "admin" || role === "teacher" || role === "demo";

  return (
    <div className="space-y-5">
      {canUpload && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">批量上传与智能整理</h2>
              <p className="mt-1 text-sm text-slate-500">一次选择多份资料，DeepSeek 只根据文件名建议标题、标签以及学生版/答案版配对。</p>
            </div>
            <ResourceUploadWizard role={role} workspaces={workspaces} courses={courses} onUploaded={() => setRefreshToken((value) => value + 1)} />
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<div className="rounded-xl border bg-white py-12 text-center text-sm text-slate-400">正在准备资料搜索…</div>}>
        <ResourceSearchToolbar role={role} courses={courses} workspaces={workspaces} />
        <div className="mt-4">
          <ResourceGroupList role={role} courses={courses} refreshToken={refreshToken} />
        </div>
      </Suspense>
    </div>
  );
}
