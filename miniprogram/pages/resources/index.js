const { request } = require("../../utils/api");

const kindText = { paper: "试卷", animation: "动画", material: "资料" };
const roleText = { student: "学生版", answer: "答案版", supplement: "补充资料" };

function absoluteFileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${getApp().globalData.fileBaseUrl}${path}`;
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    loadError: "",
    resources: [],
    query: "",
    courseId: "",
    grade: "",
    year: "",
    yearInput: "",
    subject: "",
    resourceKind: "",
    page: 1,
    hasNextPage: false,
    total: 0,
    courseOptions: [{ id: "", name: "全部课程" }],
    gradeOptions: ["全部年级", "初一", "初二", "初三"],
    subjectOptions: ["全部科目", "数学", "语文", "英语", "物理", "化学"],
    kindOptions: [
      { id: "", name: "全部类型" },
      { id: "paper", name: "试卷" },
      { id: "animation", name: "动画" },
      { id: "material", name: "资料" }
    ],
    courseIndex: 0,
    gradeIndex: 0,
    subjectIndex: 0,
    kindIndex: 0
  },

  onShow() {
    this.load(true);
  },

  onUnload() {
    if (this.queryTimer) clearTimeout(this.queryTimer);
    this.requestGeneration = (this.requestGeneration || 0) + 1;
  },

  load(reset = true) {
    const generation = (this.requestGeneration || 0) + 1;
    this.requestGeneration = generation;
    if (reset) this.setData({ loading: true, loadError: "", page: 1 });
    else this.setData({ loadingMore: true, loadError: "" });
    const page = reset ? 1 : this.data.page;
    const existingResources = reset ? [] : this.data.resources;
    const querySnapshot = {
      q: this.data.query,
      courseId: this.data.courseId,
      grade: this.data.grade,
      year: this.data.year,
      subject: this.data.subject,
      resourceKind: this.data.resourceKind,
      page,
      pageSize: 20
    };
    request("/resources", {
      data: querySnapshot
    })
      .then((data) => {
        if (generation !== this.requestGeneration) return;
        const resources = (data.resources || []).map((resource) => ({
          ...resource,
          kindText: kindText[resource.resourceKind] || "资料",
          files: (resource.files || []).map((file) => ({ ...file, roleText: roleText[file.role] || "补充资料" }))
        }));
        const courseOptions = [{ id: "", name: "全部课程" }, ...(data.courseOptions || [])];
        this.setData({
          resources: [...existingResources, ...resources],
          courseOptions,
          total: data.total || 0,
          page,
          hasNextPage: Boolean(data.hasNextPage)
        });
      })
      .catch((error) => {
        if (generation === this.requestGeneration) this.setData({ loadError: error.message || "资料加载失败", ...(reset ? { resources: [] } : {}) });
      })
      .finally(() => {
        if (generation === this.requestGeneration) this.setData({ loading: false, loadingMore: false });
      });
  },

  onQueryInput(event) {
    this.setData({ query: event.detail.value });
    if (this.queryTimer) clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => this.load(true), 500);
  },

  onFilterChange(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    if (field === "course") this.setData({ courseIndex: index, courseId: this.data.courseOptions[index].id });
    if (field === "grade") this.setData({ gradeIndex: index, grade: index === 0 ? "" : this.data.gradeOptions[index] });
    if (field === "subject") this.setData({ subjectIndex: index, subject: index === 0 ? "" : this.data.subjectOptions[index] });
    if (field === "kind") this.setData({ kindIndex: index, resourceKind: this.data.kindOptions[index].id });
    this.load(true);
  },

  onYearInput(event) {
    this.setData({ yearInput: event.detail.value });
  },

  applyYearFilter() {
    const value = String(this.data.yearInput || "").trim();
    if (value) {
      const year = Number(value);
      if (!/^\d{4}$/.test(value) || year < 1900 || year > 2100) {
        wx.showToast({ title: "请输入 1900—2100 的年份", icon: "none" });
        return;
      }
    }
    if (value === this.data.year) return;
    this.setData({ year: value, yearInput: value }, () => this.load(true));
  },

  filterUnsetYear() {
    const year = this.data.year === "unset" ? "" : "unset";
    this.setData({ year, yearInput: "" }, () => this.load(true));
  },

  loadMore() {
    if (!this.data.hasNextPage || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1 });
    this.load(false);
  },

  preview(event) {
    this.openFile(event.currentTarget.dataset, false);
  },

  download(event) {
    this.openFile(event.currentTarget.dataset, true);
  },

  openFile(file, isDownload = false) {
    if ([".html", ".htm"].includes(file.extension)) {
      wx.showLoading({ title: "打开中" });
      request(`/resources/${file.groupId}/files/${file.fileId}/ticket`, { method: "POST" })
        .then((data) => wx.navigateTo({ url: `/pages/resource-webview/index?url=${encodeURIComponent(absoluteFileUrl(data.url))}` }))
        .catch(() => wx.showToast({ title: "互动资料打开失败", icon: "none" }))
        .finally(() => wx.hideLoading());
      return;
    }
    const path = file.url;
    const url = absoluteFileUrl(path);
    if (!url) return;
    wx.showLoading({ title: isDownload ? "下载中" : "打开中" });
    wx.downloadFile({
      url,
      header: { Authorization: `Bearer ${wx.getStorageSync("mobileToken")}` },
      success(res) {
        if (res.statusCode !== 200) return wx.showToast({ title: "文件获取失败", icon: "none" });
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail() { wx.showToast({ title: "当前文件无法打开", icon: "none" }); }
        });
      },
      fail() { wx.showToast({ title: "文件获取失败", icon: "none" }); },
      complete() { wx.hideLoading(); }
    });
  }
});
