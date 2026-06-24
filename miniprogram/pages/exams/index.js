const { request } = require("../../utils/api");

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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
    request("/parent/exams")
      .then((data) => {
        const students = (data.students || []).map((student) => ({
          ...student,
          averageText: student.average === null ? "-" : `${student.average}%`,
          exams: (student.exams || []).map((exam) => ({ ...exam, dateText: formatDate(exam.date) }))
        }));
        this.setData({ students });
      })
      .finally(() => this.setData({ loading: false }));
  }
});
