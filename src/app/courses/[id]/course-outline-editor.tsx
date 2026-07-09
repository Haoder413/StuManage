"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface KnowledgePoint {
  id: string;
  courseId: string;
  name: string;
  parentId: string | null;
  orderIndex: number;
}

interface KpNode extends KnowledgePoint {
  children: KpNode[];
}

interface ParsedOutlineItem {
  tempId: string;
  parentTempId: string | null;
  name: string;
  orderIndex: number;
}

function buildTree(items: KnowledgePoint[]) {
  const map = new Map<string, KpNode>();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: KpNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sortNodes = (nodes: KpNode[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

function parseOutlineText(text: string): ParsedOutlineItem[] {
  const stack: { indent: number; tempId: string }[] = [];
  const siblingCounts = new Map<string, number>();
  const items: ParsedOutlineItem[] = [];

  text.split("\n").forEach((rawLine) => {
    const line = stripOutlineInvisibleChars(rawLine);
    if (!line.trim()) return;
    const indentText = line.match(/^\s*/)?.[0] || "";
    const indent = normalizeOutlineIndent(indentText);
    const name = line.trim().replace(/^[-*•]\s*/, "").trim();
    if (!name) return;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parentTempId = stack[stack.length - 1]?.tempId || null;
    const siblingKey = parentTempId || "root";
    const orderIndex = (siblingCounts.get(siblingKey) || 0) + 1;
    siblingCounts.set(siblingKey, orderIndex);

    const tempId = `tmp-${items.length + 1}`;
    items.push({ tempId, parentTempId, name, orderIndex });
    stack.push({ indent, tempId });
  });

  return items;
}

function stripOutlineInvisibleChars(line: string) {
  return line.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeOutlineIndent(indentText: string) {
  return indentText
    .replace(/\t/g, "    ")
    .replace(/\u3000/g, "  ")
    .length;
}

export function CourseOutlineEditor({
  courseId,
  initialKnowledgePoints,
}: {
  courseId: string;
  initialKnowledgePoints: KnowledgePoint[];
}) {
  const [knowledgePoints, setKnowledgePoints] = useState(initialKnowledgePoints);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [outlineText, setOutlineText] = useState("");
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [selectedKnowledgePointIds, setSelectedKnowledgePointIds] = useState<string[]>([]);
  const tree = buildTree(knowledgePoints);
  const allKnowledgePointIds = knowledgePoints.map((item) => item.id);
  const isAllSelected = allKnowledgePointIds.length > 0 && selectedKnowledgePointIds.length === allKnowledgePointIds.length;

  function toggleBatchDeleteMode() {
    setIsBatchDeleting((prev) => !prev);
    setSelectedKnowledgePointIds([]);
  }

  function toggleSelectedPoint(id: string) {
    setSelectedKnowledgePointIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  function toggleSelectAllPoints() {
    setSelectedKnowledgePointIds(isAllSelected ? [] : allKnowledgePointIds);
  }

  async function addPoint(parentId: string | null) {
    const name = prompt(parentId ? "新增子知识点" : "新增知识点")?.trim();
    if (!name) return;
    const res = await fetch("/api/knowledge-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, parentId, name }),
    });
    if (res.ok) {
      const created = await res.json();
      setKnowledgePoints((prev) => [...prev, created]);
    }
  }

  async function renamePoint(point: KnowledgePoint) {
    const name = prompt("重命名知识点", point.name)?.trim();
    if (!name || name === point.name) return;
    const res = await fetch("/api/knowledge-points", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: point.id, name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setKnowledgePoints((prev) => prev.map((item) => item.id === updated.id ? { ...item, name: updated.name } : item));
    }
  }

  async function deletePoint(point: KnowledgePoint) {
    if (!confirm(`删除「${point.name}」及其子知识点？`)) return;
    const childIds = collectChildIds(point.id, knowledgePoints);
    const res = await fetch(`/api/knowledge-points?id=${point.id}`, { method: "DELETE" });
    if (res.ok) {
      setKnowledgePoints((prev) => prev.filter((item) => item.id !== point.id && !childIds.includes(item.id)));
    }
  }

  async function deleteSelectedPoints() {
    if (selectedKnowledgePointIds.length === 0) return;
    const topLevelIds = getTopLevelSelectedIds(selectedKnowledgePointIds, knowledgePoints);
    const deletedIds = Array.from(new Set(topLevelIds.flatMap((id) => [id, ...collectChildIds(id, knowledgePoints)])));
    if (!confirm(`确定删除选中的 ${selectedKnowledgePointIds.length} 个知识点及其子知识点？`)) return;

    const res = await fetch("/api/knowledge-points", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: topLevelIds }),
    });
    if (res.ok) {
      setKnowledgePoints((prev) => prev.filter((item) => !deletedIds.includes(item.id)));
      setSelectedKnowledgePointIds([]);
      setIsBatchDeleting(false);
    }
  }

  async function importOutline() {
    const parsed = parseOutlineText(outlineText);
    if (parsed.length === 0) return;

    const res = await fetch("/api/knowledge-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, items: parsed }),
    });
    if (res.ok) {
      const created: KnowledgePoint[] = await res.json();
      setKnowledgePoints((prev) => [...prev, ...created]);
      setOutlineText("");
      setShowImportDialog(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        {isBatchDeleting ? (
          <>
            <Button size="sm" variant="outline" onClick={toggleBatchDeleteMode}>取消</Button>
            <Button size="sm" variant="outline" onClick={toggleSelectAllPoints}>
              {isAllSelected ? "取消全选" : "全选"}
            </Button>
            <Button size="sm" onClick={deleteSelectedPoints} disabled={selectedKnowledgePointIds.length === 0}>
              删除选中
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => addPoint(null)}>新增知识点</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>批量导入</Button>
            <Button size="sm" variant="outline" onClick={toggleBatchDeleteMode} disabled={knowledgePoints.length === 0}>批量删除</Button>
          </>
        )}
      </div>
      {tree.length === 0 ? (
        <p className="text-sm text-[#1a1a2e]/30">暂无知识点</p>
      ) : (
        <div className="divide-y divide-[#1a1a2e]/5">
          {tree.map((node) => (
            <KpNodeView
              key={node.id}
              node={node}
              depth={0}
              onAdd={addPoint}
              onRename={renamePoint}
              onDelete={deletePoint}
              isBatchDeleting={isBatchDeleting}
              selectedIds={selectedKnowledgePointIds}
              onToggleSelected={toggleSelectedPoint}
            />
          ))}
        </div>
      )}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>粘贴知识点大纲</DialogTitle></DialogHeader>
          <Textarea
            value={outlineText}
            onChange={(e) => setOutlineText(e.target.value)}
            className="min-h-[260px]"
            placeholder={"有理数\n  正负数与数轴\n    数轴上的点\n      动点问题\n  绝对值与相反数\n- 整式的加减\n  - 单项式与多项式"}
          />
          <p className="text-xs text-[#1a1a2e]/40">
            支持多级标题；缩进比上一层更深就是子级，同样缩进就是同级，缩进减少会回到上级。支持空格、Tab 和全角空格，会自动忽略粘贴文本里的不可见字符；每行开头可选用 -、* 或 • 作为项目符号。
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(false)}>取消</Button>
            <Button size="sm" onClick={importOutline} disabled={!outlineText.trim()}>导入</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function collectChildIds(parentId: string, items: KnowledgePoint[]): string[] {
  const children = items.filter((item) => item.parentId === parentId);
  return children.flatMap((child) => [child.id, ...collectChildIds(child.id, items)]);
}

function getTopLevelSelectedIds(selectedIds: string[], items: KnowledgePoint[]) {
  const selected = new Set(selectedIds);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  return selectedIds.filter((id) => {
    let parentId = itemMap.get(id)?.parentId || null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = itemMap.get(parentId)?.parentId || null;
    }
    return true;
  });
}

function KpNodeView({
  node,
  depth,
  onAdd,
  onRename,
  onDelete,
  isBatchDeleting,
  selectedIds,
  onToggleSelected,
}: {
  node: KpNode;
  depth: number;
  onAdd: (parentId: string | null) => void;
  onRename: (point: KnowledgePoint) => void;
  onDelete: (point: KnowledgePoint) => void;
  isBatchDeleting: boolean;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
}) {
  return (
    <>
      <div className="py-2 text-sm flex items-center gap-2 text-[#1a1a2e]/70" style={{ paddingLeft: `${depth * 20}px` }}>
        {isBatchDeleting && (
          <input
            type="checkbox"
            checked={selectedIds.includes(node.id)}
            onChange={() => onToggleSelected(node.id)}
            className="h-4 w-4 rounded border-[#1a1a2e]/20"
          />
        )}
        <span className="text-[#1a1a2e]/30">{depth === 0 ? "📂" : "📄"}</span>
        <span className="flex-1">{node.name}</span>
        {!isBatchDeleting && (
          <>
            <button className="text-xs text-[#1a1a2e]/35 hover:text-[#e07a5f]" onClick={() => onAdd(node.id)}>新增子知识点</button>
            <button className="text-xs text-[#1a1a2e]/35 hover:text-[#e07a5f]" onClick={() => onRename(node)}>重命名</button>
            <button className="text-xs text-[#1a1a2e]/35 hover:text-red-500" onClick={() => onDelete(node)}>删除</button>
          </>
        )}
      </div>
      {node.children.map((child) => (
        <KpNodeView
          key={child.id}
          node={child}
          depth={depth + 1}
          onAdd={onAdd}
          onRename={onRename}
          onDelete={onDelete}
          isBatchDeleting={isBatchDeleting}
          selectedIds={selectedIds}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </>
  );
}
