App({
  globalData: {
    apiBaseUrl: "https://taotaomath.top/api/mobile",
    fileBaseUrl: "https://taotaomath.top"
  },
  onLaunch() {
    const token = wx.getStorageSync("mobileToken");
    this.globalData.token = token || "";
  }
});
