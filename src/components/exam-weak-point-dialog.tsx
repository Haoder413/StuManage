"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ExamWeakPointTag {
  id: string;
  name: string;
  category: string | null;
}

export function ExamWeakPointDialog({
  open,
  title,
  description,
  weakPointTags,
  onClose,
  onCreateTag,
  onSubmit,
  submitLabel = "保存",
}: {
  open: boolean;
  title: string;
  description: string;
  weakPointTags: ExamWeakPointTag[];
  onClose: () => void;
  onCreateTag: (name: string) => Promise<ExamWeakPointTag | null>;
  onSubmit: (weakPointDescriptions: string[]) => Promise<void>;
  submitLabel?: string;
}) {
  const [searchTag, setSearchTag] = useState("");
  const [selectedWeakPoints, setSelectedWeakPoints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearchTag("");
    setSelectedWeakPoints([]);
    setSaving(false);
  }, [open, description]);

  const filteredTags = weakPointTags.filter((tag) =>
    !searchTag.trim() || tag.name.toLowerCase().includes(searchTag.trim().toLowerCase())
  );

  function toggleTag(name: string) {
    setSelectedWeakPoints((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  }

  async function addSearchTag() {
    const tag = await onCreateTag(searchTag);
    if (!tag) return;
    setSelectedWeakPoints((current) => current.includes(tag.name) ? current : [...current, tag.name]);
    setSearchTag("");
  }

  async function submit() {
    setSaving(true);
    await onSubmit(selectedWeakPoints);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-500">薄弱点</p>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Button type="button" variant="outline" className="h-12 text-base font-semibold text-gray-600" onClick={addSearchTag}>
              新增标签
            </Button>
            <Input
              className="h-12 text-base"
              placeholder="搜索标签"
              value={searchTag}
              onChange={(event) => setSearchTag(event.target.value)}
            />
          </div>

          <div className="flex min-h-10 flex-wrap gap-2">
            {selectedWeakPoints.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleTag(name)}
                className="rounded-full border bg-white px-3 py-1.5 text-sm font-medium text-gray-500 shadow-sm"
              >
                {name} <span className="ml-1 text-gray-300">x</span>
              </button>
            ))}
          </div>

          <div className="max-h-40 overflow-auto rounded-lg border bg-gray-50 p-2">
            {filteredTags.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-gray-400">暂无匹配标签</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredTags.map((tag) => {
                  const active = selectedWeakPoints.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "bg-white text-gray-500 hover:border-gray-300"}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "保存中..." : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
