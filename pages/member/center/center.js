// 会员中心
const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const member = require('../../../utils/member');

function isPaidMemberUser(userInfo) {
  return member.isActivePaidMember(userInfo);
}

Page({
  data: {
    memberInfo: null,
    userInfo: null,
    isPaidMember: false
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    void this._pullUserAndMember();
  },

  onShow() {
    void this._pullUserAndMember();
  },

  async _pullUserAndMember() {
    const userInfoCached = auth.getUserInfo();
    this.setData({
      userInfo: userInfoCached,
      isPaidMember: isPaidMemberUser(userInfoCached)
    });
    if (!userInfoCached) return;
    try {
      await auth.refreshUserInfo();
    } catch (e) {
      /* ignore */
    }
    let userInfo = auth.getUserInfo();
    this.setData({
      userInfo,
      isPaidMember: isPaidMemberUser(userInfo)
    });
    if (!isPaidMemberUser(userInfo)) {
      try {
        await api.reconcileMemberOrder();
        await auth.refreshUserInfo();
        userInfo = auth.getUserInfo();
        this.setData({
          userInfo,
          isPaidMember: isPaidMemberUser(userInfo)
        });
      } catch (e) {
        /* ignore */
      }
    }
    await this.loadMemberInfo();
  },

  // 加载会员信息
  async loadMemberInfo() {
    try {
      const memberInfo = await api.getMemberInfo();
      const expireRaw = (memberInfo && (memberInfo.memberExpireTime || memberInfo.expire_time)) || '';
      this.setData({
        memberInfo: {
          ...memberInfo,
          expire_time: expireRaw || '永久'
        }
      });
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






