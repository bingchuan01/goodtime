const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

Page({
  data: {
    list: [],
    loading: false,
    page: 1,
    hasMore: true
  },

  onShow() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadList(true);
  },

  async loadList(reset) {
    if (this.data.loading) return;
    if (!reset && !this.data.hasMore) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });
    try {
      const res = await api.getUserFavorites(page, 20);
      const items = res && res.list ? res.list : [];
      const hasMore = res && res.hasMore !== false;
      this.setData({
        list: reset ? items : [...this.data.list, ...items],
        page: page + 1,
        hasMore,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadList(false);
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/video-detail/video-detail?id=${id}` });
  }
});
