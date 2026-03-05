// 站内信列表页
const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    list: [],
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad() {},

  onShow() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.setData({ page: 1 });
    this.loadList(true);
  },

  async loadList(isRefresh = false) {
    if (this.data.loading) return;
    const page = isRefresh ? 1 : this.data.page;
    this.setData({ loading: true, refreshing: isRefresh && page === 1 });

    try {
      const { list = [], hasMore = false } = await api.getMessageList({
        page,
        pageSize: this.data.pageSize,
        type: 'inbox'
      });
      const nextList = isRefresh ? list : [...this.data.list, ...list];
      this.setData({
        list: nextList,
        page: page + 1,
        hasMore,
        loading: false,
        refreshing: false
      });
    } catch (e) {
      this.setData({ loading: false, refreshing: false });
    }
  },

  onRefresh() {
    this.setData({ page: 1 });
    this.loadList(true);
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadList(false);
  },

  onCompose() {
    wx.navigateTo({ url: '/pages/message-compose/message-compose' });
  },

  onItemTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/message-detail/message-detail?id=${id}` });
  },

  onItemLongPress(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '提示',
      content: '确定删除该站内信？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteMessage(id);
          const list = this.data.list.filter((item) => item.id !== id);
          this.setData({ list });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          // 已由 api 统一 toast
        }
      }
    });
  }
});
