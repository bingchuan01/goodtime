// 会员中心
const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const permission = require('../../../utils/permission');

Page({
  data: {
    memberInfo: null,
    userInfo: null
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadMemberInfo();
  },

  onShow() {
    // 刷新用户信息
    const userInfo = auth.getUserInfo();
    this.setData({ userInfo });
    if (userInfo) {
      this.loadMemberInfo();
    }
  },

  // 加载会员信息
  async loadMemberInfo() {
    try {
      const memberInfo = await api.getMemberInfo();
      this.setData({ memberInfo });
    } catch (error) {
      console.error('加载会员信息失败:', error);
    }
  },

  // 前往权益页面
  goBenefits() {
    wx.navigateTo({
      url: '/pages/member/benefits/benefits'
    });
  },

  // 前往升级页面
  goUpgrade() {
    wx.navigateTo({
      url: '/pages/member/upgrade/upgrade'
    });
  },

  // 获取会员等级名称
  getMemberLevelName: permission.getMemberLevelName,
  getMemberLevelColor: permission.getMemberLevelColor
});






