const { request } = require("../../utils/api");
const { readStoredDeviceKey, saveDeviceKey, miniDeviceInfo, isValidSessionToken } = require("../../utils/device-login");

Page({
  data: {
    identifier: "",
    password: "",
    privacyAccepted: false,
    loading: false,
    message: ""
  },

  onIdentifierInput(event) {
    this.setData({ identifier: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  onPrivacyChange(event) {
    this.setData({ privacyAccepted: event.detail.value.includes("accepted"), message: "" });
  },

  login() {
    if (this.data.loading) return;
    const { identifier, password, privacyAccepted } = this.data;
    if (!identifier || !password) {
      this.setData({ message: "请输入账号和密码" });
      return;
    }
    if (!privacyAccepted) {
      this.setData({ message: "请先阅读并同意设备登录与隐私说明" });
      return;
    }

    const deviceKey = readStoredDeviceKey(wx);
    const { deviceType, displayName, operatingSystem, clientVersion } = miniDeviceInfo(wx);

    this.setData({ loading: true, message: "" });
    request("/auth/login", {
      method: "POST",
      data: {
        identifier,
        password,
        deviceKey,
        deviceType,
        displayName,
        operatingSystem,
        clientVersion,
        privacyAccepted
      }
    })
      .then(async (data) => {
        if (!data || !isValidSessionToken(data.token)) {
          throw new Error("登录响应异常，请重试");
        }
        if (!saveDeviceKey(wx, data.deviceKey)) {
          try {
            await request("/auth/session", {
              method: "DELETE",
              token: data.token
            });
          } catch (_) {}
          throw new Error("设备信息保存失败，请重试");
        }
        wx.setStorageSync("mobileToken", data.token);
        wx.setStorageSync("mobileUser", data.user);
        getApp().globalData.token = data.token;
        wx.switchTab({
          url: "/pages/home/index",
          fail: (error) => {
            this.setData({
              loading: false,
              message: error.errMsg || "登录成功，但跳转首页失败"
            });
          }
        });
      })
      .catch((error) => {
        this.setData({ loading: false, message: error.message || "登录失败" });
      });
  }
});
