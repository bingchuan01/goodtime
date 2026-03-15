// 设置页
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    cacheSize: '0 B'
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadCacheSize();
  },

  onShow() {
    this.loadCacheSize();
  },

  // 获取缓存大小
  loadCacheSize() {
    try {
      const info = wx.getStorageInfoSync();
      const size = (info.currentSize || 0) * 1024;
      let sizeStr = '0 B';
      if (size >= 1024 * 1024) {
        sizeStr = (size / 1024 / 1024).toFixed(2) + ' MB';
      } else if (size >= 1024) {
        sizeStr = (size / 1024).toFixed(2) + ' KB';
      } else if (size > 0) {
        sizeStr = size + ' B';
      }
      this.setData({ cacheSize: sizeStr });
    } catch (e) {
      this.setData({ cacheSize: '0 B' });
    }
  },

  changePassword() {
    wx.navigateTo({
      url: '/pages/user/change-password/change-password'
    });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存吗？清除后需要重新登录。',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          auth.logout();
        }
      }
    });
  },

  checkUpdate() {
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        wx.showLoading({ title: '检查到新版本...' });
      } else {
        wx.showToast({ title: '当前已是最新版本', icon: 'none' });
      }
    });
    updateManager.onUpdateReady(() => {
      wx.hideLoading();
      wx.showModal({
        title: '更新提示',
        content: '新版本已就绪，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });
    updateManager.onUpdateFailed(() => {
      wx.hideLoading();
      wx.showToast({ title: '更新失败，请稍后重试', icon: 'none' });
    });
  },

  aboutUs() {
    wx.navigateTo({
      url: '/pages/user/doc/doc?type=about'
    });
  },

  privacyPolicy() {
    wx.navigateTo({
      url: '/pages/user/doc/doc?type=privacy'
    });
  },

  userAgreement() {
    wx.navigateTo({
      url: '/pages/user/doc/doc?type=user-agreement'
    });
  },

  thirdPartyList() {
    wx.navigateTo({
      url: '/pages/user/doc/doc?type=third-party'
    });
  },

  onlineService() {
    wx.showToast({
      title: '敬请期待',
      icon: 'none'
    });
  },

  deactivateAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后，您的账号数据将被删除且无法恢复。确定要注销吗？',
      confirmText: '确认注销',
      confirmColor: '#ff4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await api.post('/user/deactivate', {});
            wx.hideLoading();
            auth.logout();
            wx.showToast({ title: '已注销', icon: 'success' });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 1500);
          } catch (err) {
            wx.hideLoading();
            // 若接口未实现，提示用户
            wx.showToast({
              title: err.message || '暂不支持注销，请联系客服',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
