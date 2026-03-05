// 修改登录密码
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    showOld: false,
    showNew: false,
    showConfirm: false
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
  },

  onOldInput(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewInput(e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  toggleOld() {
    this.setData({ showOld: !this.data.showOld });
  },

  toggleNew() {
    this.setData({ showNew: !this.data.showNew });
  },

  toggleConfirm() {
    this.setData({ showConfirm: !this.data.showConfirm });
  },

  async onSubmit() {
    const { oldPassword, newPassword, confirmPassword } = this.data;

    if (!oldPassword) {
      wx.showToast({ title: '请输入原密码', icon: 'none' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' });
      return;
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入密码不一致', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '修改中...' });
      await api.post('/user/password/change', {
        old_password: oldPassword,
        new_password: newPassword
      });
      wx.hideLoading();
      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.hideLoading();
    }
  }
});
