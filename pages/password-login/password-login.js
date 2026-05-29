// 账号密码登录页
const auth = require('../../utils/auth');

Page({
  data: {
    // 登录表单数据
    account: '',
    password: '',
    showPassword: false,
    // 协议勾选
    agreed: false,
    // 加载状态
    loading: false
  },

  onLoad() {
    // 如果已登录，直接返回
    if (auth.checkLogin()) {
      wx.navigateBack();
      return;
    }
    wx.showToast({
      title: '账号密码登录即将上线',
      icon: 'none'
    });
  },

  // 账号输入
  onAccountInput(e) {
    this.setData({
      account: e.detail.value
    });
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 密码登录
  onPasswordLogin() {
    wx.showToast({
      title: '账号密码登录即将上线',
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

  // 统一登录处理（账号密码）
  async doLogin(loginData) {
    wx.showToast({ title: '账号密码登录即将上线', icon: 'none' });
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

  // 跳转到手机号登录页面
  goToPhoneLogin() {
    wx.navigateBack();
  },

  // 跳转到忘记密码页面
  goToForgotPassword() {
    wx.showToast({
      title: '该功能即将上线',
      icon: 'none'
    });
  },

  // 验证账号格式（手机号或邮箱）
  validateAccount(account) {
    // 手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    // 邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return phoneRegex.test(account) || emailRegex.test(account);
  }
});
