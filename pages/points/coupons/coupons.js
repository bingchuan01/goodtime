const api = require('../../../utils/api');

const PROJECT_COUPON_TYPES = ['extend_display', 'pin'];

Page({
  data: {
    list: [],
    loading: true,
    projectId: '',
    projectDisplay: null
  },

  onLoad(options) {
    const projectId = options.projectId ? String(options.projectId) : '';
    this.setData({ projectId });
    if (projectId) {
      this.loadProjectDisplay(projectId);
    }
  },

  onShow() {
    this.loadCoupons();
  },

  async loadProjectDisplay(projectId) {
    try {
      const info = await api.getProjectDisplay(projectId);
      this.setData({ projectDisplay: info });
    } catch (e) {
      /* ignore */
    }
  },

  async loadCoupons() {
    this.setData({ loading: true });
    try {
      const res = await api.getPointsCoupons({ status: 'unused' });
      let list = (res && res.list) || [];
      const projectId = this.data.projectId;
      if (projectId) {
        list = list.filter((item) => PROJECT_COUPON_TYPES.includes(item.type));
      }
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  async onUseCoupon(e) {
    const couponId = e.currentTarget.dataset.id;
    const couponType = e.currentTarget.dataset.type;
    const projectId = this.data.projectId;
    if (!couponId) return;

    if (PROJECT_COUPON_TYPES.includes(couponType) && !projectId) {
      wx.showToast({ title: '请从我的发布选择项目用券', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '使用中...' });
    try {
      const result = await api.postPointsCouponUse(couponId, projectId ? parseInt(projectId, 10) : undefined);
      wx.hideLoading();
      wx.showToast({ title: (result && result.message) || '使用成功', icon: 'success' });
      if (projectId) {
        this.loadProjectDisplay(projectId);
      }
      this.loadCoupons();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '使用失败', icon: 'none' });
    }
  }
});
