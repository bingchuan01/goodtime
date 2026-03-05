// 忘记密码页
Page({
  data: {
    // 当前步骤：1-4
    step: 1,
    // 表单数据
    phone: '',
    password: '',
    passwordConfirm: '',
    code: '',
    showPassword: false,
    showPasswordConfirm: false,
    // 验证码倒计时
    codeCountdown: 0,
    // 加载状态
    loading: false
  },

  onLoad() {
    // 页面加载
  },

  // 手机号输入
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value.replace(/\D/g, '')
    });
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 确认密码输入
  onPasswordConfirmInput(e) {
    this.setData({
      passwordConfirm: e.detail.value
    });
  },

  // 验证码输入
  onCodeInput(e) {
    this.setData({
      code: e.detail.value.replace(/\D/g, '')
    });
  },

  // 切换密码显示/隐藏
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  // 切换确认密码显示/隐藏
  togglePasswordConfirm() {
    this.setData({
      showPasswordConfirm: !this.data.showPasswordConfirm
    });
  },

  // 获取验证码
  onGetCode() {
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

  // 下一步
  nextStep() {
    const { step, phone, password, passwordConfirm, code } = this.data;

    if (step === 1) {
      // 验证手机号
      if (!this.validatePhone(phone)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return;
      }
      this.setData({ step: 2 });
    } else if (step === 2) {
      // 验证密码
      if (!password || password.length < 6) {
        wx.showToast({
          title: '密码至少6位',
          icon: 'none'
        });
        return;
      }
      if (password !== passwordConfirm) {
        wx.showToast({
          title: '两次密码不一致',
          icon: 'none'
        });
        return;
      }
      // 自动发送验证码
      this.onGetCode();
      this.setData({ step: 3 });
    } else if (step === 3) {
      // 验证验证码
      if (!code || code.length !== 6) {
        wx.showToast({
          title: '请输入6位验证码',
          icon: 'none'
        });
        return;
      }
      this.setData({ step: 4 });
    }
  },

  // 上一步
  prevStep() {
    if (this.data.step > 1) {
      this.setData({
        step: this.data.step - 1
      });
    }
  },

  // 确认修改
  onConfirm() {
    if (this.data.loading) return;

    const { phone, password, code } = this.data;

    this.setData({ loading: true });
    wx.showLoading({ title: '修改中...' });

    // TODO: 调用修改密码API
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '密码修改成功',
        icon: 'success'
      });

      // 返回登录页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1000);
  },

  // 验证手机号
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  }
});
