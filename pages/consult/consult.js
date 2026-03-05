// 咨询合作：用户向官方发送站内信，收件人固定为官方
const api = require('../../utils/api');
const auth = require('../../utils/auth');

const OFFICIAL_RECIPIENT_ID = 'official';

Page({
  data: {
    subject: '',
    body: '',
    contact: '',
    submitting: false
  },

  onLoad() {},

  onSubjectInput(e) {
    this.setData({ subject: e.detail.value });
  },

  onBodyInput(e) {
    this.setData({ body: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
  },

  validate() {
    const { subject, body, contact } = this.data;
    if (!subject || !subject.trim()) {
      wx.showToast({ title: '请输入主题', icon: 'none' });
      return false;
    }
    if (!body || !body.trim()) {
      wx.showToast({ title: '请输入正文', icon: 'none' });
      return false;
    }
    if (!contact || !contact.trim()) {
      wx.showToast({ title: '请输入联系方式', icon: 'none' });
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
        recipientId: OFFICIAL_RECIPIENT_ID,
        subject: this.data.subject.trim(),
        body: this.data.body.trim(),
        contact: this.data.contact.trim()
      });
      wx.hideLoading();
      this.setData({ submitting: false, subject: '', body: '', contact: '' });
      wx.showToast({ title: '已发送给官方', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
