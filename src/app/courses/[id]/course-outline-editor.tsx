"use client";

import { useState } from "react";
import { BookOpen, Circle, GripVertical } from "lucide-react";
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
  const indexOf = new Map<string, number>();
  items.forEach((item, idx) => indexOf.set(item.id, idx));
  const map = new Map<string, KpNode>();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: KpNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sortNodes = (nodes: KpNode[]) => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex || (indexOf.get(a.id) || 0) - (indexOf.get(b.id) || 0));
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: "before" | "after" | "inside" } | null>(null);
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

  // ---------- 层级拖拽 ----------

  function isDescendantOf(candidateId: string, ancestorId: string): boolean {
    let current = knowledgePoints.find((item) => item.id === candidateId)?.parentId || null;
    while (current) {
      if (current === ancestorId) return true;
      current = knowledgePoints.find((item) => item.id === current)?.parentId || null;
    }
    return false;
  }

  function canDropOn(targetId: string): boolean {
    if (!draggingId) return false;
    if (targetId === draggingId) return false;
    return !isDescendantOf(targetId, draggingId); // 不能拖进自己的子孙
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || !canDropOn(id)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;
    let zone: "before" | "after" | "inside";
    if (offsetY < height * 0.25) zone = "before";
    else if (offsetY > height * 0.75) zone = "after";
    else zone = "inside";
    setDropTarget({ id, zone });
  }

  function handleDragLeave(id: string) {
    setDropTarget((prev) => (prev && prev.id === id ? null : prev));
  }

  // 计算拖拽结果：返回新的同级排序（含被拖节点），调用方据此重排 orderIndex
  function computeDrop(targetId: string, zone: "before" | "after" | "inside"): { parentId: string | null; orderedIds: string[] } | null {
    if (!draggingId || !canDropOn(targetId)) return null;
    const target = knowledgePoints.find((item) => item.id === targetId);
    if (!target) return null;

    if (zone === "inside") {
      const siblings = knowledgePoints
        .filter((item) => item.parentId === targetId && item.id !== draggingId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      return { parentId: targetId, orderedIds: [...siblings.map((s) => s.id), draggingId] };
    }

    // before / after：成为 target 的同级，插入到正确位次
    const parentId = target.parentId;
    const siblings = knowledgePoints
      .filter((item) => item.parentId === parentId && item.id !== draggingId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const targetIdx = siblings.findIndex((item) => item.id === targetId);
    if (targetIdx === -1) return null;
    const insertAt = zone === "before" ? targetIdx : targetIdx + 1;
    const orderedIds = siblings.map((s) => s.id);
    orderedIds.splice(insertAt, 0, draggingId);
    return { parentId, orderedIds };
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropTarget || dropTarget.id !== targetId || !draggingId) {
      setDropTarget(null);
      return;
    }
    const result = computeDrop(targetId, dropTarget.zone);
    const dragId = draggingId;
    setDropTarget(null);
    setDraggingId(null);
    if (!result) return;

    const { parentId, orderedIds } = result;
    const previous = knowledgePoints;

    // 乐观更新：按 orderedIds 重排目标父级下所有同级的 parentId/orderIndex
    setKnowledgePoints((prev) => {
      const rank = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
      return prev.map((item) =>
        rank.has(item.id)
          ? { ...item, parentId, orderIndex: rank.get(item.id)! }
          : item
      );
    });

    const res = await fetch("/api/knowledge-points", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dragId, parentId, orderedIds }),
    });
    if (!res.ok) {
      setKnowledgePoints(previous); // 失败回滚
      return;
    }
    // 成功后用后端返回的整课程列表同步，保证原父级/新父级 orderIndex 都归一
    const refreshed: KnowledgePoint[] = await res.json();
    if (Array.isArray(refreshed)) setKnowledgePoints(refreshed);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
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
              draggingId={draggingId}
              dropTarget={dropTarget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
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
  draggingId,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  node: KpNode;
  depth: number;
  onAdd: (parentId: string | null) => void;
  onRename: (point: KnowledgePoint) => void;
  onDelete: (point: KnowledgePoint) => void;
  isBatchDeleting: boolean;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  draggingId: string | null;
  dropTarget: { id: string; zone: "before" | "after" | "inside" } | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const indent = depth * 28;
  const connectorLeft = Math.max(0, indent - 14);
  const iconSize = depth === 0 ? 18 : Math.max(9, 14 - Math.min(depth, 3));
  const isDragging = draggingId === node.id;
  const isDropTarget = dropTarget?.id === node.id;
  const dropZone = isDropTarget ? dropTarget.zone : null;

  return (
    <>
      <div
        onDragOver={(e) => onDragOver(e, node.id)}
        onDragLeave={() => onDragLeave(node.id)}
        onDrop={(e) => onDrop(e, node.id)}
        className={`relative py-2 text-sm flex items-center gap-2 text-[#1a1a2e]/70 transition-colors ${depth === 0 ? "font-semibold" : "font-medium"} ${
          isDragging ? "opacity-40" : ""
        } ${dropZone === "inside" ? "bg-[#5b6c8a]/10 ring-1 ring-inset ring-[#5b6c8a]/30 rounded" : ""}`}
        style={{ paddingLeft: `${indent}px` }}
      >
        {dropZone === "before" && (
          <span aria-hidden="true" className="absolute left-0 right-0 top-0 h-0.5 bg-[#e07a5f]" />
        )}
        {dropZone === "after" && (
          <span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-0.5 bg-[#e07a5f]" />
        )}
        {depth > 0 && (
          <>
            <span
              aria-hidden="true"
              className="outline-tree-connector absolute top-0 bottom-0 w-px bg-[#5b6c8a]/15"
              style={{ left: `${connectorLeft}px` }}
            />
            <span
              aria-hidden="true"
              className="outline-tree-connector absolute top-1/2 h-px w-3 bg-[#5b6c8a]/20"
              style={{ left: `${connectorLeft}px` }}
            />
          </>
        )}
        {!isBatchDeleting && (
          <span
            draggable
            onDragStart={() => onDragStart(node.id)}
            onDragEnd={onDragEnd}
            title="拖拽调整层级/顺序"
            className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[#1a1a2e]/25 hover:text-[#5b6c8a] active:cursor-grabbing"
            aria-hidden="true"
          >
            <GripVertical className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}
        {isBatchDeleting && (
          <input
            type="checkbox"
            checked={selectedIds.includes(node.id)}
            onChange={() => onToggleSelected(node.id)}
            className="h-4 w-4 rounded border-[#1a1a2e]/20"
          />
        )}
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center ${depth === 0 ? "text-[#5b6c8a]" : "text-[#7f8fa6]"}`}
          aria-hidden="true"
        >
          {depth === 0 ? (
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={2.2} />
          ) : (
            <Circle style={{ width: `${iconSize}px`, height: `${iconSize}px` }} strokeWidth={2.4} />
          )}
        </span>
        <span className={`flex-1 ${depth === 0 ? "text-[#394255]" : "text-[#4f586b]"}`}>{node.name}</span>
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
          draggingId={draggingId}
          dropTarget={dropTarget}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
}
