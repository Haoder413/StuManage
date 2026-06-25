const { request } = require("../../utils/api");

const kindText = {
  paper: "试卷",
  animation: "动画",
  material: "资料"
};

function absoluteFileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${getApp().globalData.fileBaseUrl}${path}`;
}

Page({
  data: {
    loading: true,
    loadError: "",
    resources: []
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true, loadError: "" });
    request("/resources")
      .then((data) => {
        const resources = (data.resources || []).map((resource) => ({
          ...resource,
          kindText: kindText[resource.resourceKind] || "资料"
        }));
        this.setData({ resources });
      })
      .catch((error) => this.setData({ loadError: error.message || "资料加载失败", resources: [] }))
      .finally(() => this.setData({ loading: false }));
  },

  preview(event) {
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

  download(event) {
    const url = absoluteFileUrl(event.currentTarget.dataset.url);
    if (!url) return;
    wx.setClipboardData({ data: url });
    wx.showToast({ title: "下载链接已复制", icon: "none" });
  }
});
