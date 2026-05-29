const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    summary: {},
    progressPercent: 0,
    checkedToday: false,
    calendarDays: []
  },

  onShow() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadAll();
  },

  async loadAll() {
    try {
      const summary = await api.getGrowthSummary();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const cal = await api.getGrowthCheckinCalendar(year, month);
      const checkedSet = {};
      (cal.dates || []).forEach((d) => { checkedSet[d.date] = true; });
      const today = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const calendarDays = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const checked = !!checkedSet[ds];
        calendarDays.push({
          day: d,
          date: ds,
          checked,
          isToday: ds === today,
          canMakeup: !checked && ds < today
        });
      }
      let progressPercent = 100;
      if (summary.nextLevelExp != null && summary.nextLevelExp > 0) {
        const prev = summary.nextLevelExp - summary.expToNext;
        const range = summary.nextLevelExp - (summary.requiredExp || 0);
        progressPercent = range > 0 ? Math.min(100, Math.round(((summary.totalExp - (summary.requiredExp || 0)) / range) * 100)) : 0;
      }
      this.setData({
        summary: { ...summary, streakDays: summary.streakDays },
        checkedToday: !!checkedSet[today],
        calendarDays,
        progressPercent
      });
    } catch (e) {
      console.error(e);
    }
  },

  async onCheckin() {
    if (this.data.checkedToday) return;
    try {
      const res = await api.postGrowthCheckin();
      let msg = `+${res.expGained || 0} 经验`;
      if (res.pointsGained) msg += `，+${res.pointsGained} 积分`;
      if (res.bonusExp) msg += `，连续奖励 +${res.bonusExp} 经验`;
      wx.showToast({ title: msg, icon: 'none' });
      this.loadAll();
    } catch (e) {
      /* api 已 toast */
    }
  },

  goMall() {
    wx.navigateTo({ url: '/pages/points/mall/mall' });
  },

  goExpLedger() {
    wx.navigateTo({ url: '/pages/growth/exp-ledger/exp-ledger' });
  },

  onDayTap(e) {
    const date = e.currentTarget.dataset.date;
    const can = e.currentTarget.dataset.can;
    if (!can) return;
    wx.showModal({
      title: '补签',
      content: `确定为 ${date} 补签？会员先扣免费额度，否则消耗 50 积分`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const result = await api.postGrowthCheckinMakeup(date);
          let msg = '补签成功';
          if (result.usedFree) msg += '（使用免费额度）';
          else if (result.costPoints) msg += `（-${result.costPoints} 积分）`;
          wx.showToast({ title: msg, icon: 'none' });
          this.loadAll();
        } catch (err) {
          /* api toast */
        }
      }
    });
  }
});
