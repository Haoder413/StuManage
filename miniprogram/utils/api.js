function getAppConfig() {
  const app = getApp();
  return app.globalData || {};
}

function getToken() {
  const app = getApp();
  return app.globalData.token || wx.getStorageSync("mobileToken") || "";
}

function request(path, options = {}) {
  const config = getAppConfig();
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync("mobileToken");
          getApp().globalData.token = "";
          wx.redirectTo({ url: "/pages/login/index" });
          reject(new Error("unauthorized"));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(res.data?.error || "request failed"));
          return;
        }
        resolve(res.data);
      },
      fail: reject
    });
  });
}

module.exports = { request };
