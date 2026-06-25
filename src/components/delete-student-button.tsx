"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteStudentButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function deleteStudent() {
    const confirmed = window.confirm(`确认删除学生「${studentName}」？相关成绩、排课、学习关系和家长绑定也会一并删除。`);
    if (!confirmed) return;

    setDeleting(true);
    const response = await fetch(`/api/students?id=${encodeURIComponent(studentId)}`, { method: "DELETE" });
    setDeleting(false);

    if (!response.ok) {
      window.alert("删除失败，请稍后重试");
      return;
    }

    router.refresh();
  }

  return (
    <Button disabled={deleting} onClick={deleteStudent} size="sm" type="button" variant="destructive">
      {deleting ? "删除中..." : "删除"}
    </Button>
  );
}
