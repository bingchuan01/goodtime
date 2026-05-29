const api = require('../../../utils/api');

Page({
  data: {
    list: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onShow() {
    this.setData({ list: [], page: 1, hasMore: true });
    this.loadMore();
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.getPointsOrders({ page: this.data.page, pageSize: 20 });
      const chunk = (res && res.list) || [];
      this.setData({
        list: this.data.list.concat(chunk),
        page: this.data.page + 1,
        hasMore: !!res.hasMore,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  }
});
