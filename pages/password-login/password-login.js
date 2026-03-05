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
    }
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
    const { account, password } = this.data;

    // 验证账号格式（手机号或邮箱）
    if (!account) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'
      });
      return;
    }

    if (!this.validateAccount(account)) {
      wx.showToast({
        title: '请输入正确的手机号或邮箱',
        icon: 'none'
      });
      return;
    }

    if (!password || password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none'
      });
      return;
    }

    this.doLogin({
      type: 'password',
      account: account,
      password: password
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
        icon: 'success'
      });

      // 返回上一页或跳转首页
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 统一登录处理
  doLogin(loginData) {
    wx.showLoading({ title: '登录中...' });
    
    // TODO: 调用登录API
    setTimeout(() => {
      // 模拟登录成功
      wx.setStorageSync('token', 'mock_token_' + Date.now());
      wx.setStorageSync('userInfo', {
        id: 'user_' + Date.now(),
        account: loginData.account
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // 返回上一页或跳转首页
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }, 1500);
    }, 1000);
  },

  // 协议勾选
  onAgreementChange(e) {
    const checked = e.detail.value.includes('agree');
    this.setData({
      agreed: checked
    });
  },

  // 跳转到协议页面
  goToAgreement(e) {
    const type = e.currentTarget.dataset.type;
    // TODO: 跳转到协议页面
    wx.showToast({
      title: `查看${type === 'user' ? '用户协议' : '隐私协议'}`,
      icon: 'none'
    });
  },

  // 跳转到手机号登录页面
  goToPhoneLogin() {
    wx.navigateBack();
  },

  // 跳转到忘记密码页面
  goToForgotPassword() {
    wx.navigateTo({
      url: '/pages/forgot-password/forgot-password'
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
