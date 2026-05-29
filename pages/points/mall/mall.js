const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

Page({
  data: {
    balance: 0,
    expiringSoon: 0,
    expireAt: '',
    categories: [],
    activeCategory: '',
    products: [],
    loading: true
  },

  onShow() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [bal, cats] = await Promise.all([
        api.getPointsBalance(),
        api.getPointsMallCategories()
      ]);
      const categories = cats || [];
      const activeCategory = this.data.activeCategory || (categories[0] && categories[0].id) || '';
      const prodRes = await api.getPointsMallProducts({ categoryId: activeCategory });
      const products = (prodRes && prodRes.list) || prodRes || [];
      this.setData({
        balance: bal.balance || 0,
        expiringSoon: bal.expiringSoon || 0,
        expireAt: bal.expireAt || '',
        categories,
        activeCategory,
        products: Array.isArray(products) ? products : [],
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ activeCategory: id }, () => this.loadProducts());
  },

  async loadProducts() {
    try {
      const prodRes = await api.getPointsMallProducts({ categoryId: this.data.activeCategory });
      const products = (prodRes && prodRes.list) || prodRes || [];
      this.setData({ products: Array.isArray(products) ? products : [] });
    } catch (e) {}
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/points/detail/detail?id=' + id });
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/points/orders/orders' });
  },

  goCoupons() {
    wx.navigateTo({ url: '/pages/points/coupons/coupons' });
  }
});
