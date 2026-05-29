const api = require('../../../utils/api');

const ACTION_LABELS = {
  checkin: '每日签到',
  makeup: '补签',
  streak_bonus: '连续签到奖励',
  admin_adjust: '运营调整',
  share: '分享',
  register: '拉新'
};

Page({
  data: { list: [], page: 1, hasMore: true, loading: false },

  onShow() {
    this.setData({ list: [], page: 1, hasMore: true });
    this.loadMore();
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.getGrowthExpLedger({ page: this.data.page, pageSize: 20 });
      const chunk = (res.list || []).map((r) => ({
        ...r,
        actionLabel: ACTION_LABELS[r.action] || r.action
      }));
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
