"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StudentCourseOption = {
  id: string;
  studentName: string;
  studentGrade: string | null;
};

export function CompleteCourseButton({
  courseId,
  students,
  disabled,
}: {
  courseId: string;
  students: StudentCourseOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});

  async function completeCourse() {
    setLoading(true);
    try {
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: courseId,
          action: "complete",
          evaluations: students.map((student) => ({
            studentCourseId: student.id,
            evaluation: evaluations[student.id] || "",
          })),
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled || students.length === 0}>
        结课
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>结课评价</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {students.map((student) => (
              <div key={student.id} className="rounded-lg border border-[#1a1a2e]/10 p-3">
                <Label className="text-sm font-semibold text-[#1a1a2e]">
                  {student.studentName}{student.studentGrade ? ` · ${student.studentGrade}` : ""}
                </Label>
                <Textarea
                  className="mt-2"
                  value={evaluations[student.id] || ""}
                  onChange={(event) => setEvaluations((prev) => ({ ...prev, [student.id]: event.target.value }))}
                  placeholder="填写本课程对该学生的结课评价"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>取消</Button>
            <Button size="sm" onClick={completeCourse} disabled={loading}>确认结课</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
