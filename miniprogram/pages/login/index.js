const { request } = require("../../utils/api");

Page({
  data: {
    identifier: "",
    password: "",
    loading: false,
    message: ""
  },

  onIdentifierInput(event) {
    this.setData({ identifier: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  login() {
    const { identifier, password } = this.data;
    if (!identifier || !password) {
      this.setData({ message: "请输入账号和密码" });
      return;
    }

    this.setData({ loading: true, message: "" });
    request("/auth/login", {
      method: "POST",
      data: { identifier, password }
    })
      .then((data) => {
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
