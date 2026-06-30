"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function HomeworkDeleteButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function deleteHomework() {
    const confirmed = window.confirm("确定删除这份作业吗？题目结构、学生提交和批改记录都会一起删除。");
    if (!confirmed) return;
    setDeleting(true);
    const res = await fetch(`/api/homework/${assignmentId}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      window.alert("删除失败，请稍后重试。");
      return;
    }
    router.push("/homework");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={deleteHomework} disabled={deleting}>
      {deleting ? "删除中..." : "删除作业"}
    </Button>
  );
}
