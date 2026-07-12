"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { BookOpen, Circle } from "lucide-react";
import { calculateConsistentProgressStatuses } from "@/lib/knowledge-progress-tree";

interface KPNode {
  id: string;
  name: string;
  parentId: string | null;
  orderIndex: number;
  children: KPNode[];
  status?: string;
}

interface StudentData {
  id: string;
  name: string;
  grade: string | null;
  lessonFrequency: string | null;
}

interface WeakPoint {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  masteredAt: string | null;
  reviewSchedules: ReviewSchedule[];
}

interface WeakPointTag {
  id: string;
  name: string;
  category: string | null;
  source?: "library" | "student";
}

interface ReviewSchedule {
  id: string;
  stage: number;
  status: string;
  lastReviewedAt: string | null;
}

function buildKpTree(items: KPNode[]) {
  const map = new Map<string, KPNode>();
  items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: KPNode[] = [];

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });

  const sortNodes = (nodes: KPNode[]) => {
    nodes.sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.name.localeCompare(b.name, "zh-CN");
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function countKpNodes(nodes: KPNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countKpNodes(node.children), 0);
}

export default function StudentProgressDetailPage() {
  const params = useParams();
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState<"knowledge" | "weakness">("knowledge");
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "mastered">("all");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [kpTree, setKpTree] = useState<KPNode[]>([]);
  const [kpProgress, setKpProgress] = useState<Record<string, string>>({});
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [historyWeakPoints, setHistoryWeakPoints] = useState<WeakPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWeakDesc, setNewWeakDesc] = useState("");
  const [tags, setTags] = useState<any[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [studentsRes, progressRes] = await Promise.all([
          fetch("/api/students"),
          fetch(`/api/progress?studentId=${encodeURIComponent(studentId)}`),
        ]);
        const allStudents = studentsRes.ok ? await studentsRes.json() : [];
        const allProgress = progressRes.ok ? await progressRes.json() : [];
        const studentList: StudentData[] = Array.isArray(allStudents) ? allStudents : [];
        const progressList: any[] = Array.isArray(allProgress) ? allProgress : [];
        const found = studentList.find((s) => s.id === studentId) || null;
        const studentProgress = progressList
          .filter((p: any) => p.studentId === studentId)
          .sort((a: any, b: any) => Number(Boolean(b.learningLinkId)) - Number(Boolean(a.learningLinkId)));

        const progressMap: Record<string, string> = {};
        const nodes: KPNode[] = [];
        const seen = new Set<string>();
        studentProgress.forEach((p: any) => {
          if (!p.knowledgePointId || seen.has(p.knowledgePointId)) return;
          seen.add(p.knowledgePointId);
          progressMap[p.knowledgePointId] = p.status;
          nodes.push({
            id: p.knowledgePointId,
            name: p.knowledgePoint?.name || "未知",
            parentId: p.knowledgePoint?.parentId || null,
            orderIndex: Number(p.knowledgePoint?.orderIndex || 0),
            children: [],
            status: p.status,
          });
        });

        const [activeWeakPoints, historyPoints] = found?.id
          ? await Promise.all([
              loadWeakPoints(found.id),
              loadWeakPoints(found.id, "history"),
            ])
          : [[], []];

        if (!cancelled) {
          setStudent(found);
          setKpProgress(calculateConsistentProgressStatuses(
            nodes.map((node) => ({ id: node.id, parentId: node.parentId })),
            progressMap,
          ));
          setKpTree(buildKpTree(nodes));
          setWeakPoints(activeWeakPoints);
          setHistoryWeakPoints(historyPoints);
        }
      } catch (error) {
        console.error("Failed to load student progress detail", error);
        if (!cancelled) {
          setStudent(null);
          setKpProgress({});
          setKpTree([]);
          setWeakPoints([]);
          setHistoryWeakPoints([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Load tags for autocomplete
  useEffect(() => {
    fetch("/api/weak-point-tags").then(r => r.json()).then(setTags).catch(() => {});
  }, []);
  async function loadWeakPoints(sid: string, status = "active"): Promise<WeakPoint[]> {
    try {
      const res = await fetch(`/api/weak-points?studentId=${sid}&status=${status}`);
      if (res.ok) return await res.json();
    } catch {}
    return [];
  }

  async function refreshWeakPoints() {
    const [active, history] = await Promise.all([
      loadWeakPoints(studentId),
      loadWeakPoints(studentId, "history"),
    ]);
    setWeakPoints(active);
    setHistoryWeakPoints(history);
  }

  async function updateKpStatus(kpId: string, status: string) {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, knowledgePointId: kpId, status }),
    });
    if (!res.ok) return;
    const result = await res.json();
    setKpProgress((prev) => {
      const next = { ...prev, [kpId]: status };
      const ancestorUpdates = Array.isArray(result.ancestorUpdates) ? result.ancestorUpdates : [];
      ancestorUpdates.forEach((update: { knowledgePointId?: string; status?: string }) => {
        if (update.knowledgePointId && update.status) next[update.knowledgePointId] = update.status;
      });
      return next;
    });
  }

  async function addWeakPoint() {
    if (!newWeakDesc.trim()) return;
    await fetch("/api/weak-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, description: newWeakDesc.trim() }),
    });
    setNewWeakDesc("");
    await refreshWeakPoints();
  }

  async function markWeakpointMastered(wpId: string) {
    const res = await fetch("/api/weak-points", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: wpId, status: "mastered" }),
    });
    if (res.ok) await refreshWeakPoints();
  }

  async function markReviewCompleted(wpId: string) {
    const res = await fetch("/api/weak-points", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: wpId, reviewCompleted: true }),
    });
    if (res.ok) await refreshWeakPoints();
  }

  async function reactivateWeakPoint(wpId: string) {
    const res = await fetch("/api/weak-points", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: wpId, status: "active" }),
    });
    if (res.ok) await refreshWeakPoints();
  }

  function selectWeakPointTag(name: string) {
    setNewWeakDesc(name);
    setShowTagManager(false);
    setShowSuggestions(false);
  }

  if (loading) return <div className="p-6"><div className="flex items-center gap-3 mb-2">
        <Link href="/progress"><Button variant="outline" size="sm">← 返回</Button></Link>
      </div>
      
<PageHeader title="加载中..." /></div>;
  if (!student) return <div className="p-6"><div className="flex items-center gap-3 mb-2">
        <Link href="/progress"><Button variant="outline" size="sm">← 返回</Button></Link>
      </div>
      
<PageHeader title="学生未找到" /></div>;

  const totalKps = countKpNodes(kpTree);
  const masteredCount = Object.values(kpProgress).filter((s) => s === "mastered").length;
  const learningCount = totalKps - masteredCount;
  const progressPct = totalKps > 0 ? Math.round((masteredCount / totalKps) * 100) : 0;

  const allReviewWeakPoints = [...weakPoints, ...historyWeakPoints];
  const allWeakPointTagOptions: WeakPointTag[] = (() => {
    const names = new Set<string>();
    const merged: WeakPointTag[] = [];
    tags.forEach((tag) => {
      if (!tag.name || names.has(tag.name)) return;
      names.add(tag.name);
      merged.push({ ...tag, source: "library" });
    });
    allReviewWeakPoints.forEach((point) => {
      const name = point.description.trim();
      if (!name || names.has(name)) return;
      names.add(name);
      merged.push({ id: `weak-point-${point.id}`, name, category: "已有薄弱点", source: "student" });
    });
    return merged;
  })();
  const pendingReviewCount = weakPoints.length;

  const tabs = [
    { key: "knowledge" as const, label: "📖 知识点进度", count: totalKps },
    { key: "weakness" as const, label: "薄弱点复习", count: allReviewWeakPoints.length },
  ];

  const reviewFilters = [
    { key: "all" as const, label: "全部", count: allReviewWeakPoints.length },
    { key: "pending" as const, label: "待复习", count: pendingReviewCount },
    { key: "mastered" as const, label: "已掌握", count: historyWeakPoints.length },
  ];

  const filteredWeakPoints = allReviewWeakPoints.filter((wp) => {
    if (reviewFilter === "pending") return wp.status === "active";
    if (reviewFilter === "mastered") return wp.status !== "active";
    return true;
  }).sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  function renderKpNode(kp: KPNode, depth = 0) {
    const status = kpProgress[kp.id] === "mastered" ? "mastered" : "learning";
    const statusColors: Record<string, string> = {
      mastered: "bg-green-100 text-green-700 border-green-200",
      learning: "bg-blue-100 text-blue-700 border-blue-200",
    };
    const statusLabels: Record<string, string> = {
      mastered: "已学习",
      learning: "学习中",
    };
    const nextStatus: Record<string, string> = {
      learning: "mastered",
      mastered: "learning",
    };
    const indent = depth * 28;
    const connectorLeft = Math.max(0, indent - 14);
    const iconSize = depth === 0 ? 18 : Math.max(9, 14 - Math.min(depth, 3));

    return (
      <div key={kp.id}>
        <div
          className={`relative flex items-center gap-2 border-b border-[#1a1a2e]/5 py-2 text-sm text-[#1a1a2e]/70 ${depth === 0 ? "font-semibold" : "font-medium"}`}
          style={{ paddingLeft: `${indent}px` }}
        >
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
          <span className={`min-w-0 flex-1 truncate ${depth === 0 ? "text-[#394255]" : "text-[#4f586b]"}`}>{kp.name}</span>
          <button
            onClick={() => updateKpStatus(kp.id, nextStatus[status])}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${statusColors[status]}`}
          >
            {statusLabels[status]}
          </button>
        </div>
        {kp.children.map((child) => renderKpNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/progress"><Button variant="outline" size="sm">← 返回</Button></Link>
      </div>
      
<PageHeader
        title={`${student.name} · 学习进度`}
        description={`${student.grade || ""} · ${student.lessonFrequency || ""}`}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">知识点总数</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalKps}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">已学习</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{masteredCount}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">学习中</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{learningCount}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">整体进度</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{progressPct}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100/50 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.key ? "bg-gray-200 text-gray-600" : "bg-gray-200 text-gray-500"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Knowledge Points */}
      {activeTab === "knowledge" && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">知识点进度管理</h3>
            <div className="h-2 flex-1 max-w-xs mx-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs text-gray-500">{masteredCount}/{totalKps}</span>
          </div>

          {kpTree.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无知识点数据</p>
          ) : (
            <div className="divide-y divide-[#1a1a2e]/5">
              {kpTree.map((kp) => renderKpNode(kp))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Weak Point Review */}
      {activeTab === "weakness" && (
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">薄弱点复习</h3>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="输入薄弱点描述..."
                  value={newWeakDesc}
                  onChange={(e) => { setNewWeakDesc(e.target.value); if (e.target.value) setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={(e) => e.key === "Enter" && addWeakPoint()}
                />
                {showSuggestions && newWeakDesc && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {tags.filter(t => t.name.includes(newWeakDesc)).map(t => (
                      <button key={t.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                        onMouseDown={() => { setNewWeakDesc(t.name); setShowSuggestions(false); }}>
                        <span className="text-gray-700">{t.name}</span>
                        {t.category && <span className="text-xs text-gray-400 ml-2">({t.category})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={addWeakPoint} disabled={!newWeakDesc.trim()}>添加</Button>
              <Button variant="outline" onClick={() => setShowTagManager(true)} title="管理薄弱点标签">🏷️</Button>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex flex-wrap gap-1 mb-4 bg-gray-100/50 rounded-lg p-1 w-fit">
              {reviewFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setReviewFilter(filter.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    reviewFilter === filter.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && <span className="ml-1 text-gray-400">{filter.count}</span>}
                </button>
              ))}
            </div>

            {filteredWeakPoints.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">暂无薄弱点记录</p>
            ) : (
              <div className="space-y-3">
                {filteredWeakPoints.map((wp) => {
                  const completedCount = wp.reviewSchedules?.filter((rs) => rs.status === "completed").length || 0;
                  const lastReviewed = wp.reviewSchedules
                    ?.filter((rs) => rs.lastReviewedAt)
                    .sort((a, b) => new Date(b.lastReviewedAt || "").getTime() - new Date(a.lastReviewedAt || "").getTime())[0];
                  const isMastered = wp.status !== "active";
                  const statusLabel = isMastered ? "已掌握" : "待复习";

                  return (
                    <div key={wp.id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{wp.description}</p>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              wp.status === "active" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-700"
                            }`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            创建于 {new Date(wp.createdAt).toLocaleDateString("zh-CN")}
                            {wp.masteredAt && <span> · 掌握于 {new Date(wp.masteredAt).toLocaleDateString("zh-CN")}</span>}
                            <span> · 已复习 {completedCount} 次</span>
                            <span> · 最近复习 {lastReviewed?.lastReviewedAt ? new Date(lastReviewed.lastReviewedAt).toLocaleDateString("zh-CN") : "-"}</span>
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {wp.status === "active" && (
                            <Button size="sm" variant="outline" onClick={() => markReviewCompleted(wp.id)}>已复习</Button>
                          )}
                          {wp.status === "active" ? (
                            <Button size="sm" onClick={() => markWeakpointMastered(wp.id)}>已掌握</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => reactivateWeakPoint(wp.id)}>重新激活</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag Manager Dialog */}
      <Dialog open={showTagManager} onOpenChange={setShowTagManager}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">🏷️ 选择薄弱点标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new tag form */}
            <div className="flex gap-2">
              <Input placeholder="标签名称" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="flex-1" />
              <Input placeholder="分类（可选）" value={newTagCategory} onChange={e => setNewTagCategory(e.target.value)} className="w-28" />
              <Button size="sm" onClick={async () => {
                if (!newTagName.trim()) return;
                await fetch("/api/weak-point-tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTagName.trim(), category: newTagCategory.trim() || null }) });
                setNewTagName(""); setNewTagCategory("");
                const res = await fetch("/api/weak-point-tags"); setTags(await res.json());
              }}>添加</Button>
            </div>
            {/* Tag list */}
            <div className="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-2">
              {allWeakPointTagOptions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无薄弱点标签</p>
              ) : (
                allWeakPointTagOptions.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                    <button type="button" className="flex-1 text-left" onClick={() => selectWeakPointTag(t.name)}>
                      <span className="text-sm font-medium text-gray-700">{t.name}</span>
                      {t.category && <span className="text-xs text-gray-400 ml-2">({t.category})</span>}
                    </button>
                    {t.source !== "student" && (
                      <button className="text-red-400 hover:text-red-600 text-sm" onClick={async () => {
                        await fetch(`/api/weak-point-tags?id=${t.id}`, { method: "DELETE" });
                        setTags(prev => prev.filter(x => x.id !== t.id));
                      }}>删除</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
