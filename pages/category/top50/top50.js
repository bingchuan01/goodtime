const api = require('../../../utils/api');

Page({
  data: {
    projectList: [],
    loading: false,
    loadError: false
  },

  onLoad() {
    this.loadPool();
  },

  async loadPool() {
    this.setData({ loading: true, loadError: false });
    try {
      const res = await api.getSurgePool();
      const list = res && res.list ? res.list : [];
      this.setData({ projectList: list, loading: false });
    } catch (e) {
      this.setData({ loading: false, loadError: true });
    }
  },

  async onProjectTap(e) {
    const { projectId, project } = e.detail;
    if (!projectId) return;
    wx.showLoading({ title: '加载中...' });
    try {
      const detail = await api.getProjectDetail(projectId);
      getApp().globalData.prefetchedProject = { id: String(projectId), data: detail };
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/video-detail/video-detail?id=${projectId}&coverType=${encodeURIComponent((project && project.coverType) || 'image')}&memberLevel=${encodeURIComponent((project && project.memberLevel) || '')}`
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  }
});
