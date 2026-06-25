App({
  globalData: {
    localApiBaseUrl: "http://127.0.0.1:3001/api/mobile",
    productionApiBaseUrl: "https://taotaomath.top/api/mobile",
    apiBaseUrl: "http://127.0.0.1:3001/api/mobile",
    fileBaseUrl: "https://taotaomath.top"
  },
  onLaunch() {
    const token = wx.getStorageSync("mobileToken");
    this.globalData.token = token || "";
  }
});
