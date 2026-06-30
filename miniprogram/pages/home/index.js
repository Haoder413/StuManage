const { request } = require("../../utils/api");

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function normalizeCourseName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function dedupeCourses(courses) {
  const seen = {};
  return (courses || []).reduce((items, course) => {
    const name = normalizeCourseName(course.name);
    if (!name || seen[name]) return items;
    seen[name] = true;
    items.push({ ...course, name });
    return items;
  }, []);
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
          courses: dedupeCourses(student.courses),
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
  },

  goHomework() {
    wx.navigateTo({ url: "/pages/homework/index" });
  }
});
