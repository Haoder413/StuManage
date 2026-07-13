"use client";

import { useCallback, useEffect, useState } from "react";

export interface WeakPointTag {
  id: string;
  name: string;
  category: string | null;
}

export function useWeakPointTags() {
  const [weakPointTags, setWeakPointTags] = useState<WeakPointTag[]>([]);
  const [weakPointTagsLoading, setWeakPointTagsLoading] = useState(true);

  const loadWeakPointTags = useCallback(async () => {
    setWeakPointTagsLoading(true);
    try {
      const response = await fetch("/api/weak-point-tags");
      if (!response.ok) return [];
      const tags = await response.json() as WeakPointTag[];
      setWeakPointTags(tags);
      return tags;
    } catch {
      return [];
    } finally {
      setWeakPointTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeakPointTags();
  }, [loadWeakPointTags]);

  const createWeakPointTag = useCallback(async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const existing = weakPointTags.find((tag) => tag.name === cleanName);
    if (existing) return existing;

    const response = await fetch("/api/weak-point-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cleanName, category: null }),
    });
    if (!response.ok) return null;

    const created = await response.json() as WeakPointTag;
    setWeakPointTags((current) =>
      [...current.filter((tag) => tag.id !== created.id), created]
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    );
    return created;
  }, [weakPointTags]);

  return { weakPointTags, weakPointTagsLoading, createWeakPointTag, reloadWeakPointTags: loadWeakPointTags };
}
