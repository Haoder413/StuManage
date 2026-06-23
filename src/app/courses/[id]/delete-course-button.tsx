"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteCourseButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`确定删除课程「${courseName}」？对应的排课和考勤记录也会一起删除。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/courses?id=${courseId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/courses");
        router.refresh();
        return;
      }
      alert("删除失败，请稍后再试。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
      {deleting ? "删除中..." : "删除课程"}
    </Button>
  );
}
