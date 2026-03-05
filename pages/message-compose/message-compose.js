// 写站内信页
const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    recipientId: '',
    recipientName: '',
    subject: '',
    body: '',
    submitting: false
  },

  onLoad(options) {
    const recipientId = options.recipientId ? decodeURIComponent(options.recipientId) : '';
    const recipientName = options.recipientName ? decodeURIComponent(options.recipientName) : '';
    this.setData({ recipientId, recipientName });
  },

  onRecipientInput(e) {
    this.setData({ recipientName: e.detail.value });
  },

  onSubjectInput(e) {
    this.setData({ subject: e.detail.value });
  },

  onBodyInput(e) {
    this.setData({ body: e.detail.value });
  },

  validate() {
    const { recipientName, subject, body } = this.data;
    if (!recipientName || !recipientName.trim()) {
      wx.showToast({ title: '请输入收件人', icon: 'none' });
      return false;
    }
    if (!subject || !subject.trim()) {
      wx.showToast({ title: '请输入主题', icon: 'none' });
      return false;
    }
    if (!body || !body.trim()) {
      wx.showToast({ title: '请输入正文', icon: 'none' });
      return false;
    }
    return true;
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.validate()) return;
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发送中...' });

    try {
      await api.sendMessage({
        recipientId: this.data.recipientId || undefined,
        recipientName: this.data.recipientName.trim(),
        subject: this.data.subject.trim(),
        body: this.data.body.trim()
      });
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '发送成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
