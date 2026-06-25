const { request } = require("../../utils/api");

const statusText = {
  mastered: "已掌握",
  learning: "学习中",
  not_started: "未开始"
};

const weakPointFilters = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待复习" },
  { key: "active", label: "当前薄弱" },
  { key: "mastered", label: "巩固中" },
  { key: "done", label: "已完成" }
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
  const isDone = point.status !== "active" && !hasPendingReview;
  const statusLabel = point.statusLabel || (point.status === "active" ? "当前薄弱" : hasPendingReview ? "巩固中" : "已完成");
  const reviewStageText = point.reviewStageLabel || (point.reviewStage ? `第${point.reviewStage}次` : "待复习");
  return {
    ...point,
    statusLabel,
    statusClass: point.status === "active" ? "weak-status weak-active" : hasPendingReview ? "weak-status weak-pending" : "weak-status weak-done",
    createdText: `创建于 ${formatPlainDate(point.createdAt) || "-"}`,
    masteredText: point.masteredAt ? `掌握于 ${formatPlainDate(point.masteredAt)}` : "",
    completedReviewCount: point.completedReviewCount || 0,
    hasPendingReview,
    isDone,
    lastReviewedText: point.lastReviewedAt ? formatPlainDate(point.lastReviewedAt) : "-",
    reviewStageText,
    nextReviewText: hasPendingReview ? `${reviewStageText} · ${formatPlainDate(point.nextReviewAt)}` : "暂无待复习"
  };
}

function buildWeakPointFilters(student) {
  return weakPointFilters.map((filter) => {
    const count = filter.key === "all"
      ? student.weakPoints.length
      : filter.key === "pending"
        ? student.pendingWeakPointCount
        : filter.key === "active"
          ? student.currentWeakPointCount
          : filter.key === "mastered"
            ? student.consolidatingWeakPointCount
            : student.completedWeakPointCount;
    return {
      ...filter,
      count,
      className: "weak-filter"
    };
  });
}

function filterWeakPoints(weakPoints, filter) {
  if (filter === "pending") return weakPoints.filter((point) => point.hasPendingReview);
  if (filter === "active") return weakPoints.filter((point) => point.status === "active");
  if (filter === "mastered") return weakPoints.filter((point) => point.status !== "active" && point.hasPendingReview);
  if (filter === "done") return weakPoints.filter((point) => point.isDone);
  return weakPoints;
}

function decorateStudent(student) {
  const weakPoints = (student.weakPoints || []).map(decorateWeakPoint);
  const activeWeakPointFilter = student.activeWeakPointFilter || "all";
  const nextStudent = {
    ...student,
    activeWeakPointFilter,
    currentWeakPointCount: student.currentWeakPointCount || 0,
    pendingWeakPointCount: student.pendingWeakPointCount || 0,
    consolidatingWeakPointCount: student.consolidatingWeakPointCount || 0,
    completedWeakPointCount: student.completedWeakPointCount || 0,
    knowledgePoints: (student.knowledgePoints || []).map((kp) => ({
      ...kp,
      statusText: statusText[kp.status] || "未开始"
    })),
    weakPoints
  };
  return {
    ...nextStudent,
    weakPointFilters: buildWeakPointFilters(nextStudent).map((filter) => ({
      ...filter,
      className: `${filter.className}${filter.key === activeWeakPointFilter ? " weak-filter-active" : ""}`
    })),
    filteredWeakPoints: filterWeakPoints(weakPoints, activeWeakPointFilter)
  };
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
        this.setData({
          students: (data.students || []).map(decorateStudent)
        });
      })
      .catch((error) => this.setData({ loadError: error.message || "进度加载失败", students: [] }))
      .finally(() => this.setData({ loading: false }));
  },

  changeWeakPointFilter(event) {
    const studentIndex = Number(event.currentTarget.dataset.studentIndex);
    const filterKey = event.currentTarget.dataset.filterKey;
    const students = this.data.students.map((student, index) => (
      index === studentIndex ? decorateStudent({ ...student, activeWeakPointFilter: filterKey }) : student
    ));
    this.setData({ students });
  }
});
