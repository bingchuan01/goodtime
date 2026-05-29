const api = require('../../../utils/api');

Page({
  data: {
    product: null,
    redeeming: false
  },

  onLoad(options) {
    const id = options.id;
    if (id) this.loadProduct(id);
  },

  async loadProduct(id) {
    try {
      const product = await api.getPointsMallProductDetail(id);
      this.setData({ product });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async onRedeem() {
    if (!this.data.product || this.data.redeeming) return;
    this.setData({ redeeming: true });
    try {
      await api.postPointsRedeem({ productId: this.data.product.id, quantity: 1 });
      wx.showToast({ title: '兑换成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      /* api toast */
    } finally {
      this.setData({ redeeming: false });
    }
  }
});
