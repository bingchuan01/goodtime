// 站内信详情页
const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    id: null,
    msg: null,
    loading: false
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '消息不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.setData({ id });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const msg = await api.getMessageDetail(this.data.id);
      this.setData({ msg, loading: false });
      await api.markMessageRead(this.data.id);
      if (this.data.msg) {
        this.setData({ 'msg.isRead': true });
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onReply() {
    const { msg } = this.data;
    if (!msg || !msg.sender) return;
    const q = `recipientId=${encodeURIComponent(msg.sender.id)}&recipientName=${encodeURIComponent(msg.sender.nickname)}`;
    wx.navigateTo({ url: `/pages/message-compose/message-compose?${q}` });
  },

  onAvatarError() {
    const defaultAvatar = '/images/icons/default-avatar.svg';
    if (this.data.msg && this.data.msg.sender && this.data.msg.sender.avatar !== defaultAvatar) {
      this.setData({ 'msg.sender.avatar': defaultAvatar });
    }
  },

  onDelete() {
    wx.showModal({
      title: '提示',
      content: '确定删除该站内信？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteMessage(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          wx.navigateBack();
        } catch (err) {
          // 已由 api 统一 toast
        }
      }
    });
  }
});
