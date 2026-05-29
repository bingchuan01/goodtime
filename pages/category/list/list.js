const api = require('../../../utils/api');

const DEFAULT_PRICE_RANGES = [
  { id: '1-5', label: '1～5万' },
  { id: '6-10', label: '6～10万' },
  { id: '11-20', label: '11～20万' },
  { id: '21-50', label: '21～50万' },
  { id: '50+', label: '50万以上' }
];

Page({
  data: {
    pageTitle: '项目列表',
    projectList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadError: false,
    filters: {
      top50: false,
      priceRange: '',
      region: ''
    },
    priceRanges: DEFAULT_PRICE_RANGES,
    showFilterPanel: false,
    regionInput: ''
  },

  onLoad(options) {
    this.loadPriceRanges();
    const title = options.title ? decodeURIComponent(options.title) : '项目列表';
    const top50 = options.top50 === '1';
    this._query = {
      categoryId: options.categoryId ? decodeURIComponent(options.categoryId) : '',
      categoryTag: options.categoryTag ? decodeURIComponent(options.categoryTag) : '',
      displayZone: options.displayZone ? decodeURIComponent(options.displayZone) : '',
      inSurgePool: top50 ? '1' : (options.inSurgePool === '1' ? '1' : '')
    };
    this.setData({
      pageTitle: top50 ? 'Top50强' : title,
      'filters.top50': top50
    });
    this.loadProjects(true);
  },

  async loadPriceRanges() {
    try {
      const data = await api.getCategoryNav();
      if (data && data.priceRanges && data.priceRanges.length) {
        this.setData({ priceRanges: data.priceRanges });
      }
    } catch (e) {
      /* use default */
    }
  },

  async loadProjects(reset) {
    if (this.data.loading) return;
    if (!reset && !this.data.hasMore) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true, loadError: reset ? false : this.data.loadError });
    try {
      const { filters } = this.data;
      const params = {
        page,
        pageSize: this.data.pageSize,
        ...this._query
      };
      if (filters.top50) params.inSurgePool = '1';
      if (filters.priceRange) params.priceRange = filters.priceRange;
      if (filters.region) params.region = filters.region;

      const res = await api.getProjectList(params);
      const list = res && res.list ? res.list : [];
      const hasMore = res && res.hasMore !== false;
      this.setData({
        projectList: reset ? list : [...this.data.projectList, ...list],
        page: page + 1,
        hasMore,
        loading: false,
        loadError: false
      });
    } catch (e) {
      this.setData({ loading: false, loadError: true });
    }
  },

  onReachBottom() {
    this.loadProjects(false);
  },

  onRetry() {
    this.loadProjects(true);
  },

  toggleFilter() {
    this.setData({ showFilterPanel: !this.data.showFilterPanel });
  },

  onRegionInput(e) {
    this.setData({ regionInput: e.detail.value });
  },

  onPriceTap(e) {
    const id = e.currentTarget.dataset.id;
    const cur = this.data.filters.priceRange;
    this.setData({ 'filters.priceRange': cur === id ? '' : id });
  },

  onTop50FilterTap() {
    this.setData({ 'filters.top50': !this.data.filters.top50 });
  },

  applyFilters() {
    this.setData({
      'filters.region': (this.data.regionInput || '').trim(),
      showFilterPanel: false
    });
    this.loadProjects(true);
  },

  resetFilters() {
    this.setData({
      filters: { top50: false, priceRange: '', region: '' },
      regionInput: '',
      showFilterPanel: false
    });
    this._query.inSurgePool = '';
    this.loadProjects(true);
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
