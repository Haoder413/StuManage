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
    request("/parent/home")
      .then((data) => {
        const students = (data.students || []).map((student) => ({
          ...student,
          latestExams: (student.latestExams || []).map((exam) => ({ ...exam, dateText: formatDate(exam.date) })),
          latestLessons: (student.latestLessons || []).map((lesson) => ({
            ...lesson,
            dateText: formatDate(lesson.date),
            weakPointText: (lesson.weakPointTags || []).join("、")
          }))
        }));
        this.setData({ students });
      })
      .finally(() => this.setData({ loading: false }));
  }
});
