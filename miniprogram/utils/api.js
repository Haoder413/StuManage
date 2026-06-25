function getAppConfig() {
  const app = getApp();
  return app.globalData || {};
}

function getToken() {
  const app = getApp();
  return app.globalData.token || wx.getStorageSync("mobileToken") || "";
}

function normalizeRequestError(error) {
  const message = error?.errMsg || error?.message || "";
  if (message.includes("timeout")) {
    return new Error("接口连接超时，请检查服务地址或服务是否启动");
  }
  if (message.includes("url not in domain list") || message.includes("domain")) {
    return new Error("接口域名未配置，请在开发者工具关闭域名校验或配置业务域名");
  }
  if (message.includes("ssl") || message.includes("TLS") || message.includes("certificate")) {
    return new Error("接口 HTTPS 证书校验失败，请检查域名证书配置");
  }
  return error instanceof Error ? error : new Error(message || "网络请求失败");
}

function normalizeHttpError(res) {
  const serverMessage = typeof res.data?.error === "string" ? res.data.error : "";
  if (res.statusCode >= 500) {
    return new Error(serverMessage || `HTTP 500：服务器开小差了，请稍后重试`);
  }
  if (res.statusCode === 403) return new Error(serverMessage || "当前账号无权访问");
  if (res.statusCode === 404) return new Error(serverMessage || "接口不存在，请检查服务版本");
  return new Error(serverMessage || `HTTP ${res.statusCode}：请求失败`);
}

function request(path, options = {}) {
  const config = getAppConfig();
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      timeout: options.timeout || 10000,
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
          const normalizedError = normalizeHttpError(res);
          wx.showToast({ title: normalizedError.message, icon: "none", duration: 2500 });
          reject(normalizedError);
          return;
        }
        resolve(res.data);
      },
      fail(error) {
        const normalizedError = normalizeRequestError(error);
        wx.showToast({ title: normalizedError.message, icon: "none", duration: 2500 });
        reject(normalizedError);
      }
    });
  });
}

module.exports = { request };
