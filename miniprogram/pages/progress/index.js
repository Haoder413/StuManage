const { request } = require("../../utils/api");

const statusText = {
  mastered: "已掌握",
  learning: "学习中",
  not_started: "未开始"
};

const weakPointFilters = [
  { key: "active", label: "当前薄弱" },
  { key: "pending", label: "待复习" },
  { key: "all", label: "全部" }
];

function formatDate(value) {
  if (!value) return "暂无待复习";
  const date = new Date(value);
  return `下次复习：${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPlainDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function decorateWeakPoint(point) {
  const hasPendingReview = Boolean(point.nextReviewAt);
  const statusLabel = point.statusLabel || (point.status === "active" ? "当前薄弱" : hasPendingReview ? "巩固中" : "已完成");
  const reviewStageText = point.reviewStageLabel || (point.reviewStage ? `第${point.reviewStage}次` : "待复习");
  return {
    ...point,
    statusLabel,
    statusClass: point.status === "active" ? "weak-status weak-active" : hasPendingReview ? "weak-status weak-pending" : "weak-status weak-done",
    createdText: `创建于 ${formatPlainDate(point.createdAt) || "-"}`,
    masteredText: point.masteredAt ? `掌握于 ${formatPlainDate(point.masteredAt)}` : "",
    completedReviewCount: point.completedReviewCount || 0,
    reviewStageText,
    nextReviewText: hasPendingReview ? `${reviewStageText} · ${formatPlainDate(point.nextReviewAt)}` : "暂无待复习"
  };
}

function buildWeakPointFilters(student) {
  return weakPointFilters.map((filter) => {
    const count = filter.key === "active"
      ? student.currentWeakPointCount
      : filter.key === "pending"
        ? student.pendingWeakPointCount
        : student.weakPoints.length;
    return {
      ...filter,
      count,
      className: filter.key === "active" ? "weak-filter weak-filter-orange" : filter.key === "pending" ? "weak-filter weak-filter-blue" : "weak-filter weak-filter-gray"
    };
  });
}

Page({
  data: {
    loading: true,
    loadError: "",
    students: []
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true, loadError: "" });
    request("/parent/progress")
      .then((data) => {
        const students = (data.students || []).map((student) => ({
          ...student,
          currentWeakPointCount: student.currentWeakPointCount || 0,
          pendingWeakPointCount: student.pendingWeakPointCount || 0,
          knowledgePoints: (student.knowledgePoints || []).map((kp) => ({
            ...kp,
            statusText: statusText[kp.status] || "未开始"
          })),
          weakPoints: (student.weakPoints || []).map(decorateWeakPoint)
        }));
        this.setData({
          students: students.map((student) => ({
            ...student,
            weakPointFilters: buildWeakPointFilters(student)
          }))
        });
      })
      .catch((error) => this.setData({ loadError: error.message || "进度加载失败", students: [] }))
      .finally(() => this.setData({ loading: false }));
  }
});
