// 编辑资料页
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    userInfo: null,
    nickname: '',
    avatarUrl: ''
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = auth.getUserInfo();
    if (userInfo) {
      this.setData({
        userInfo,
        nickname: userInfo.nickname || '',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar_url || ''
      });
    }
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          wx.showLoading({ title: '上传中...' });
          const filePath = res && res.tempFilePaths && res.tempFilePaths[0];
          if (!filePath) {
            wx.hideLoading();
            wx.showToast({ title: '未选择图片', icon: 'none' });
            return;
          }

          const uploadRes = await api.uploadFileOrOss(filePath, '.jpg');
          const avatarUrl = (uploadRes && uploadRes.url) || (uploadRes && uploadRes.data && uploadRes.data.url) || '';
          if (!avatarUrl) {
            throw new Error('头像上传失败');
          }
          this.setData({ avatarUrl });
          wx.hideLoading();
          wx.showToast({ title: '头像已更新', icon: 'success' });
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: (error && error.message) || '头像上传失败',
            icon: 'none'
          });
        }
      }
    });
  },

  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  async onSave() {
    if (!this.data.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });
      await api.updateUserInfo({
        nickname: this.data.nickname.trim(),
        avatar_url: this.data.avatarUrl
      });
      await auth.refreshUserInfo();
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
    }
  }
});
