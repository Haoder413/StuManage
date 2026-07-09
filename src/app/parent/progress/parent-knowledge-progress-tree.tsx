"use client";

import { useMemo, useState } from "react";

type ParentKnowledgeProgressItem = {
  id: string;
  status: string;
  knowledgePoint: {
    id: string;
    name: string;
    parentId: string | null;
    orderIndex: number;
    courseId: string;
  };
};

type KnowledgeProgressTreeNode = ParentKnowledgeProgressItem & {
  children: KnowledgeProgressTreeNode[];
};

const statusLabels: Record<string, string> = {
  mastered: "已学习",
  learning: "学习中",
  not_started: "学习中",
};

const statusStyles: Record<string, string> = {
  mastered: "border-green-200 bg-green-50 text-green-700",
  learning: "border-blue-200 bg-blue-50 text-blue-700",
  not_started: "border-gray-200 bg-gray-50 text-gray-500",
};

function normalizeStatus(status: string) {
  return status === "mastered" ? "mastered" : "learning";
}

function sortTreeNodes(nodes: KnowledgeProgressTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.knowledgePoint.courseId !== b.knowledgePoint.courseId) {
      return a.knowledgePoint.courseId.localeCompare(b.knowledgePoint.courseId);
    }
    if (a.knowledgePoint.orderIndex !== b.knowledgePoint.orderIndex) {
      return a.knowledgePoint.orderIndex - b.knowledgePoint.orderIndex;
    }
    return a.knowledgePoint.name.localeCompare(b.knowledgePoint.name, "zh-CN");
  });
  nodes.forEach((node) => sortTreeNodes(node.children));
}

function buildKnowledgeProgressTree(items: ParentKnowledgeProgressItem[]) {
  const nodeMap = new Map<string, KnowledgeProgressTreeNode>();
  items.forEach((item) => {
    nodeMap.set(item.knowledgePoint.id, { ...item, children: [] });
  });

  const roots: KnowledgeProgressTreeNode[] = [];
  nodeMap.forEach((node) => {
    const parentId = node.knowledgePoint.parentId;
    const parent = parentId ? nodeMap.get(parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  sortTreeNodes(roots);
  return roots;
}

function collectDefaultExpandedIds(nodes: KnowledgeProgressTreeNode[]) {
  return nodes.filter((node) => node.children.length > 0).map((node) => node.knowledgePoint.id);
}

export function ParentKnowledgeProgressTree({ items }: { items: ParentKnowledgeProgressItem[] }) {
  const tree = useMemo(() => buildKnowledgeProgressTree(items), [items]);
  const defaultExpandedIds = useMemo(() => collectDefaultExpandedIds(tree), [tree]);
  const [expandedIds, setExpandedIds] = useState<string[]>(defaultExpandedIds);

  function toggleExpanded(id: string) {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function renderNode(node: KnowledgeProgressTreeNode, depth = 0) {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.includes(node.knowledgePoint.id);
    const normalizedStatus = normalizeStatus(node.status);
    const statusClass = statusStyles[normalizedStatus] || statusStyles.learning;
    const leftPadding = 12 + depth * 22;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className="flex items-center gap-2 border-b border-slate-100 py-2.5 pr-3 last:border-b-0"
          style={{ paddingLeft: `${leftPadding}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.knowledgePoint.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-blue-600"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
                {expanded ? "▾" : "▸"}
              </span>
              <span className="truncate">{node.knowledgePoint.name}</span>
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
              <span className="truncate">{node.knowledgePoint.name}</span>
            </div>
          )}
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabels[normalizedStatus] || "学习中"}
          </span>
        </div>
        {hasChildren && expanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return <div className="space-y-1 rounded-xl border border-slate-100 bg-white">{tree.map((node) => renderNode(node))}</div>;
}
