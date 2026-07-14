Page({
  data: { url: "" },
  onLoad(options) {
    try {
      this.setData({ url: decodeURIComponent(options.url || "") });
    } catch {
      wx.showToast({ title: "资料地址无效", icon: "none" });
    }
  }
});
