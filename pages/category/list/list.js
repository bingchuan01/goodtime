const api = require('../../../utils/api');
const categoryNav = require('../../../utils/categoryNav');

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
    l2Sections: [],
    groupByL2: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loadError: false,
    filters: {
      typeKey: '',
      typeLabel: '',
      priceRange: '',
      region: ''
    },
    priceRanges: DEFAULT_PRICE_RANGES,
    showFilterPanel: false,
    regionInput: '',
    fromAllFilter: false,
    filterTypes: [],
    activeFilterTags: []
  },

  onLoad(options) {
    this.loadNavMeta();
    const title = options.title ? decodeURIComponent(options.title) : '项目列表';
    const fromFilter = options.fromFilter === '1';
    const priceRange = options.priceRange ? decodeURIComponent(options.priceRange) : '';
    const region = options.region ? decodeURIComponent(options.region) : '';
    const typeLabel = options.typeLabel ? decodeURIComponent(options.typeLabel) : '';
    const priceLabel = options.priceLabel ? decodeURIComponent(options.priceLabel) : '';
    const l1Id = options.l1Id ? decodeURIComponent(options.l1Id) : '';
    const l1Meta = l1Id ? categoryNav.getL1Meta(l1Id) : null;
    const l2Count = l1Id ? (categoryNav.L2_BY_L1[l1Id] || []).length : 0;
    this._l1Id = l1Id;
    this._groupByL2 = !!(l1Id && l1Meta && !l1Meta.noL2 && l2Count > 0);
    this._query = {
      categoryId: options.categoryId ? decodeURIComponent(options.categoryId) : '',
      categoryTag: options.categoryTag ? decodeURIComponent(options.categoryTag) : '',
      displayZone: options.displayZone ? decodeURIComponent(options.displayZone) : '',
      inSurgePool: options.inSurgePool === '1' ? '1' : ''
    };
    const activeFilterTags = [];
    if (fromFilter) {
      if (typeLabel) {
        activeFilterTags.push({ key: 'type', label: typeLabel });
      }
      if (priceRange) {
        const pr = DEFAULT_PRICE_RANGES.find((r) => r.id === priceRange);
        activeFilterTags.push({ key: 'price', label: priceLabel || (pr ? pr.label : priceRange) });
      }
      if (region) {
        activeFilterTags.push({ key: 'region', label: region });
      }
    }
    this.setData({
      pageTitle: title,
      fromAllFilter: fromFilter,
      groupByL2: this._groupByL2,
      pageSize: this._groupByL2 ? 50 : 10,
      'filters.priceRange': priceRange,
      'filters.region': region,
      regionInput: region,
      activeFilterTags
    });
    this.loadProjects(true);
  },

  async loadNavMeta() {
    try {
      const data = await api.getCategoryNav();
      const merged = categoryNav.mergeNavFromApi(data);
      this.setData({
        filterTypes: merged.filterTypes,
        priceRanges: merged.priceRanges
      });
    } catch (e) {
      /* use defaults */
    }
  },

  _applyGroupedView(list, reset) {
    if (!this._groupByL2 || !this._l1Id) {
      this.setData({
        projectList: reset ? list : [...this.data.projectList, ...list],
        l2Sections: []
      });
      return;
    }
    const all = reset ? list : [...this.data.projectList, ...list];
    this.setData({
      projectList: all,
      l2Sections: categoryNav.groupProjectsByL2(all, this._l1Id)
    });
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
      if (filters.priceRange) params.priceRange = filters.priceRange;
      if (filters.region) params.region = filters.region;

      const res = await api.getProjectList(params);
      const list = res && res.list ? res.list : [];
      const hasMore = res && res.hasMore !== false;
      this._applyGroupedView(list, reset);
      this.setData({
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
    if (this.data.fromAllFilter) {
      wx.navigateBack();
      return;
    }
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

  onFilterTypeTap(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.filterTypes.find((t) => t.key === key);
    if (!item) return;
    const cur = this.data.filters.typeKey;
    if (cur === key) {
      this._query.categoryId = '';
      this._query.categoryTag = '';
      this._query.displayZone = '';
      this.setData({ 'filters.typeKey': '', 'filters.typeLabel': '' });
    } else {
      this._query.categoryId = item.categoryId || '';
      this._query.categoryTag = '';
      this._query.displayZone = item.displayZone || '';
      this.setData({ 'filters.typeKey': key, 'filters.typeLabel': item.label });
    }
  },

  applyFilters() {
    const region = (this.data.regionInput || '').trim();
    this.setData({ 'filters.region': region, showFilterPanel: false });
    this.loadProjects(true);
  },

  resetFilters() {
    this._query.categoryId = '';
    this._query.categoryTag = '';
    this._query.displayZone = '';
    this.setData({
      filters: { typeKey: '', typeLabel: '', priceRange: '', region: '' },
      regionInput: '',
      showFilterPanel: false
    });
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
