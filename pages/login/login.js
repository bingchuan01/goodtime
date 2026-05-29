// 登录页（微信一键登录为主）
const auth = require('../../utils/auth');

Page({
  data: {
    // 协议勾选
    agreed: false,
    // 加载状态
    loading: false
  },

  onLoad() {
    // 如果已登录，直接返回
    if (auth.checkLogin()) {
      wx.navigateBack();
    }
  },

  // 跳转到账号密码登录页面
  goToPasswordLogin() {
    wx.showToast({
      title: '账号密码登录即将上线',
      icon: 'none'
    });
  },

  // 短信验证码登录入口（暂不上线）
  onCodeLogin() {
    wx.showToast({
      title: '短信验证码登录即将上线',
      icon: 'none'
    });
  },

  // 微信一键登录
  async onWxLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      await auth.wxLogin();
      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1200
      });
      auth.goHomeAfterLogin(350);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && error.message) || '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  // 协议勾选
  onAgreementChange(e) {
    const checked = e.detail.value.includes('agree');
    this.setData({
      agreed: checked
    });
  },

  // 跳转到协议页面（与「我的-设置」文档页一致）
  goToAgreement(e) {
    const type = e.currentTarget.dataset.type;
    const url =
      type === 'user'
        ? '/pages/user/doc/doc?type=user-agreement'
        : '/pages/user/doc/doc?type=privacy';
    wx.navigateTo({ url });
  },
});






