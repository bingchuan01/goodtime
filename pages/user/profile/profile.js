// MVP 版个人中心
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    isLoggedIn: false,
    loginStatusText: '未登录',
    userInfo: null,
    stats: {
      projectCount: 0,
      likeCount: 0,
      viewCount: 0
    },
    growthSummary: null
  },

  onShow() {
    this._syncLoginState();
    if (auth.checkLogin()) {
      this.loadUserInfo();
    }
  },

  _syncLoginState() {
    const isLoggedIn = auth.checkLogin();
    this.setData({
      isLoggedIn,
      loginStatusText: isLoggedIn ? '已登录' : '未登录',
      userInfo: isLoggedIn ? auth.getUserInfo() || {} : null
    });
  },

  goLogin() {
    if (auth.checkLogin()) {
      wx.showToast({ title: '您已登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadUserInfo() {
    const userInfo = auth.getUserInfo();
    this.setData({ userInfo: userInfo || {} });
    try {
      await auth.refreshUserInfo();
      const updatedInfo = auth.getUserInfo();
      this.setData({ userInfo: updatedInfo || {} });
    } catch (e) {
      /* 刷新失败时使用缓存 */
    }
    this.loadStats();
    this.loadGrowthBrief();
  },

  async loadGrowthBrief() {
    try {
      const summary = await api.getGrowthSummary();
      this.setData({ growthSummary: summary });
    } catch (e) {
      /* 未登录或接口不可用 */
    }
  },

  async loadStats() {
    const userInfo = this.data.userInfo;
    if (!userInfo || !userInfo.id) return;
    try {
      const result = await api.getUserVideos(userInfo.id, 1, 100);
      const list = Array.isArray(result) ? result : (result?.list || result?.data || []);
      this.setData({
        'stats.projectCount': Array.isArray(list) ? list.length : 0
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  editProfile() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/user/profile-edit/profile-edit'
    });
  },

  goSettings() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/user/settings/settings'
    });
  },

  myProjects() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/user/videos/videos'
    });
  },

  goMessages() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({
      url: '/pages/message-list/message-list'
    });
  },

  memberCenter() {
    wx.switchTab({
      url: '/pages/member/benefits/benefits'
    });
  },

  goGrowth() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({ url: '/pages/growth/checkin/checkin' });
  },

  goPointsMall() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    wx.navigateTo({ url: '/pages/points/mall/mall' });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
        }
      }
    });
  }
});
