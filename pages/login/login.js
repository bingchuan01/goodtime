// 手机号登录/注册页
const auth = require('../../utils/auth');

Page({
  data: {
    // 登录表单数据
    phone: '',
    code: '',
    // 验证码倒计时
    codeCountdown: 0,
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

  // 手机号输入
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value.replace(/\D/g, '')
    });
  },

  // 验证码输入
  onCodeInput(e) {
    this.setData({
      code: e.detail.value.replace(/\D/g, '')
    });
  },

  // 获取验证码（登录）
  onGetCode() {
    // 如果倒计时中或手机号为空，不允许点击
    if (this.data.codeCountdown > 0 || !this.data.phone) {
      return;
    }

    if (!this.validatePhone(this.data.phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    // 开始倒计时
    this.startCountdown();
    
    // 调用获取验证码接口
    wx.showLoading({ title: '发送中...' });
    // TODO: 调用实际API
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      });
    }, 1000);
  },

  // 倒计时
  startCountdown() {
    this.setData({ codeCountdown: 60 });
    const timer = setInterval(() => {
      if (this.data.codeCountdown <= 1) {
        clearInterval(timer);
        this.setData({ codeCountdown: 0 });
      } else {
        this.setData({ codeCountdown: this.data.codeCountdown - 1 });
      }
    }, 1000);
  },

  // 验证码登录
  onCodeLogin() {
    if (!this.validatePhone(this.data.phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }
    if (!this.data.code || this.data.code.length !== 6) {
      wx.showToast({
        title: '请输入6位验证码',
        icon: 'none'
      });
      return;
    }

    this.doLogin({
      type: 'code',
      phone: this.data.phone,
      code: this.data.code
    });
  },

  // 跳转到账号密码登录页面
  goToPasswordLogin() {
    wx.navigateTo({
      url: '/pages/password-login/password-login'
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


  // 统一登录处理（当前为手机号模拟登录，未调后端）
  doLogin(loginData) {
    wx.showLoading({ title: '登录中...' });
    
    // TODO: 调用登录API
    setTimeout(() => {
      const phone = (loginData.phone || '').trim();
      // 试机账号：13638112727 配置为 V6 会员，用于闪电发布等
      const isV6TestPhone = phone === '13638112727';
      const userId = isV6TestPhone ? 'user_13638112727' : 'user_' + Date.now();
      const userInfo = {
        id: userId,
        phone: phone
      };
      if (isV6TestPhone) {
        userInfo.memberLevel = 'V6';
        userInfo.member_level = 'V6';
      }
      wx.setStorageSync('token', 'mock_token_' + userId);
      wx.setStorageSync('userInfo', userInfo);
      
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


  // 验证手机号
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  }
});






