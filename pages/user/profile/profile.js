// MVP 版个人中心
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    userInfo: null,
    stats: {
      projectCount: 0,
      likeCount: 0,
      viewCount: 0
    }
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    const userInfo = auth.getUserInfo();
    this.setData({ userInfo: userInfo || {} });
    try {
      await auth.refreshUserInfo();
      const updatedInfo = auth.getUserInfo();
      this.setData({ userInfo: updatedInfo || {} });
    } catch (e) {
      // 刷新失败时使用缓存
    }
    this.loadStats();
  },

  // 加载统计数据
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

  // 编辑资料（点击头像或编辑按钮）
  editProfile() {
    wx.navigateTo({
      url: '/pages/user/profile-edit/profile-edit'
    });
  },

  // 设置页
  goSettings() {
    wx.navigateTo({
      url: '/pages/user/settings/settings'
    });
  },

  // 我的发布（项目管理栏）
  myProjects() {
    wx.navigateTo({
      url: '/pages/user/videos/videos'
    });
  },

  // 站内信
  goMessages() {
    wx.navigateTo({
      url: '/pages/message-list/message-list'
    });
  },

  // 会员权益
  memberCenter() {
    wx.switchTab({
      url: '/pages/member/benefits/benefits'
    });
  },

  // 退出登录
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






