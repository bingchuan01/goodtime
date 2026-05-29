// app.js
const api = require('./utils/api');

function captureShareQuery(query) {
  if (!query) return;
  const fromUid = query.fromUid || query.refUserId;
  const shareId = query.shareId;
  if (fromUid) api.saveShareRef(fromUid, shareId);
}

App({
  globalData: {
    prefetchedProject: null,
    /** 待首页播放：看板全屏展示 1.5s 后收起 */
    homeDashboardIntroPending: false,
    /** 'launch' 冷启动引导进首页 | 'login' 账号登录回首页 */
    homeDashboardIntroKind: null,
    /** 本次冷启动是否已播过看板入场（避免 Tab 预加载在引导页期间偷跑动画） */
    homeDashboardLaunchIntroPlayed: false
  },
  onLaunch(options) {
    try {
      wx.removeStorageSync('homeDashboardIntro');
    } catch (e) {
      /* ignore */
    }
    this.globalData.homeDashboardIntroPending = false;
    this.globalData.homeDashboardIntroKind = null;
    this.globalData.homeDashboardLaunchIntroPlayed = false;
    captureShareQuery(options && options.query);
  },
  onShow(options) {
    captureShareQuery(options && options.query);
  },
  onHide() {}
})
