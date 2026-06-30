const { request, upload, fileUrl } = require("../../utils/api");

function formatDate(value) {
  if (!value) return "未设置";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function absoluteFileUrl(path) {
  return fileUrl(path);
}

Page({
  data: {
    loading: true,
    submittingId: "",
    submissions: []
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true });
    request("/parent/homework")
      .then((data) => {
        const submissions = (data.submissions || []).map((item) => ({
          ...item,
          dueText: formatDate(item.assignment && item.assignment.dueAt),
          submittedText: item.currentVersion ? formatDate(item.currentVersion.submittedAt) : "",
          reviewCount: item.currentVersion && item.currentVersion.reviews ? item.currentVersion.reviews.length : 0,
          versions: (item.versions || []).map((version) => ({
            ...version,
            submittedText: formatDate(version.submittedAt),
            statusText: version.status === "graded" ? "已批改" : "待批改"
          }))
        }));
        this.setData({ submissions });
      })
      .finally(() => this.setData({ loading: false }));
  },

  previewQuestion(event) {
    const url = absoluteFileUrl(event.currentTarget.dataset.url);
    if (!url) return;
    wx.downloadFile({
      url,
      header: { Authorization: `Bearer ${wx.getStorageSync("mobileToken")}` },
      success(res) {
        wx.openDocument({ filePath: res.tempFilePath, showMenu: true });
      }
    });
  },

  copyAnswerUrl(event) {
    const url = absoluteFileUrl(event.currentTarget.dataset.url);
    if (!url) return;
    wx.setClipboardData({ data: url });
    wx.showToast({ title: "下载答案/解析链接已复制", icon: "none" });
  },

  copySubmissionUrl(event) {
    const url = absoluteFileUrl(event.currentTarget.dataset.url);
    if (!url) return;
    wx.setClipboardData({ data: url });
    wx.showToast({ title: "提交文件链接已复制", icon: "none" });
  },

  chooseAndUpload(event) {
    const submissionId = event.currentTarget.dataset.id;
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["pdf", "png", "jpg", "jpeg", "webp"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        this.setData({ submittingId: submissionId });
        upload(`/parent/homework/${submissionId}/submit`, file.path)
          .then(() => {
            wx.showToast({ title: "答案已上传", icon: "success" });
            this.load();
          })
          .finally(() => this.setData({ submittingId: "" }));
      }
    });
  }
});
