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
        avatarUrl: userInfo.avatar_url || ''
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
          const uploadInfo = await api.get('/upload/image/token');
          // TODO: 上传到 COS 后设置 avatarUrl
          // const avatarUrl = await uploadToCOS(uploadInfo, res.tempFilePaths[0]);
          // this.setData({ avatarUrl });
          wx.hideLoading();
        } catch (error) {
          wx.hideLoading();
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
