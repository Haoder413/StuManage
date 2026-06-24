const { request } = require("../../utils/api");

const statusText = {
  mastered: "已掌握",
  learning: "学习中",
  not_started: "未开始"
};

function formatDate(value) {
  if (!value) return "暂无待复习";
  const date = new Date(value);
  return `下次复习：${date.getMonth() + 1}月${date.getDate()}日`;
}

Page({
  data: {
    loading: true,
    students: []
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true });
    request("/parent/progress")
      .then((data) => {
        const students = (data.students || []).map((student) => ({
          ...student,
          knowledgePoints: (student.knowledgePoints || []).map((kp) => ({
            ...kp,
            statusText: statusText[kp.status] || "未开始"
          })),
          weakPoints: (student.weakPoints || []).map((point) => ({
            ...point,
            nextReviewText: formatDate(point.nextReviewAt)
          }))
        }));
        this.setData({ students });
      })
      .finally(() => this.setData({ loading: false }));
  }
});
