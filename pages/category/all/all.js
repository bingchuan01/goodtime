const api = require('../../../utils/api');
const categoriesUtil = require('../../../utils/categories');
const categoryNav = require('../../../utils/categoryNav');

Page({
  data: {
    l1List: [],
    selectedL1Id: '',
    selectedL1Name: '',
    l2List: [],
    showFilterPanel: false,
    filterL1Options: [],
    priceRanges: categoryNav.PRICE_RANGES,
    filterDraft: {
      l1Id: '',
      typeKey: '',
      typeLabel: '',
      categoryId: '',
      categoryTag: '',
      displayZone: '',
      priceRange: '',
      priceLabel: '',
      region: ''
    },
    activeFilters: [],
    regionInput: ''
  },

  onLoad() {
    this.loadPageData();
  },

  async loadPageData() {
    let navData = null;
    try {
      navData = await api.getCategoryNav();
    } catch (e) {
      /* fallback */
    }
    const merged = categoryNav.mergeNavFromApi(navData);
    let l1List = categoriesUtil.DEFAULT_CATEGORIES;
    try {
      const res = await api.getCategories();
      const list = Array.isArray(res) ? res : (res?.list || res?.data || []);
      l1List = categoriesUtil.normalizeList(list);
    } catch (e) {
      /* use default */
    }
    l1List = l1List.filter((item) => {
      const meta = categoryNav.getL1Meta(item.id);
      return !(meta && meta.noL2);
    });
    const filterL1Options = (merged.filterTypes || []).filter((item) => {
      const meta = categoryNav.getL1Meta(item.l1Id);
      return !(meta && meta.noL2);
    });
    const first = l1List[0];
    const l2List = first ? categoryNav.getL2ByL1(first.id) : [];
    this.setData({
      l1List,
      selectedL1Id: first ? first.id : '',
      selectedL1Name: first ? first.name : '',
      l2List,
      filterL1Options,
      priceRanges: merged.priceRanges
    });
  },

  _refreshL2(l1Id) {
    return categoryNav.getL2ByL1(l1Id);
  },

  onL1Tap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.l1List.find((i) => i.id === id);
    if (!item) return;
    this.setData({
      selectedL1Id: id,
      selectedL1Name: item.name,
      l2List: this._refreshL2(id)
    });
  },

  onL2Tap(e) {
    const index = e.currentTarget.dataset.index;
    const l2 = this.data.l2List[index];
    if (!l2) return;
    wx.navigateTo({ url: `/pages/category/list/list?${categoryNav.buildListQueryFromL2(l2)}` });
  },

  onTop50Tap() {
    wx.navigateTo({ url: '/pages/category/top50/top50' });
  },

  toggleFilter() {
    this.setData({ showFilterPanel: !this.data.showFilterPanel });
  },

  closeFilter() {
    this.setData({ showFilterPanel: false });
  },

  onFilterL1Tap(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.filterL1Options.find((t) => t.key === key);
    if (!item) return;
    const cur = this.data.filterDraft.typeKey;
    if (cur === key) {
      this.setData({
        'filterDraft.l1Id': '',
        'filterDraft.typeKey': '',
        'filterDraft.typeLabel': '',
        'filterDraft.categoryId': '',
        'filterDraft.categoryTag': '',
        'filterDraft.displayZone': ''
      });
    } else {
      this.setData({
        'filterDraft.l1Id': item.l1Id,
        'filterDraft.typeKey': key,
        'filterDraft.typeLabel': item.label,
        'filterDraft.categoryId': item.categoryId || '',
        'filterDraft.categoryTag': '',
        'filterDraft.displayZone': item.displayZone || ''
      });
    }
  },

  onPriceTap(e) {
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label;
    const cur = this.data.filterDraft.priceRange;
    if (cur === id) {
      this.setData({ 'filterDraft.priceRange': '', 'filterDraft.priceLabel': '' });
    } else {
      this.setData({ 'filterDraft.priceRange': id, 'filterDraft.priceLabel': label });
    }
  },

  onRegionInput(e) {
    this.setData({ regionInput: e.detail.value });
  },

  resetFilterDraft() {
    this.setData({
      filterDraft: {
        l1Id: '',
        typeKey: '',
        typeLabel: '',
        categoryId: '',
        categoryTag: '',
        displayZone: '',
        priceRange: '',
        priceLabel: '',
        region: ''
      },
      regionInput: ''
    });
  },

  applyFilter() {
    const draft = { ...this.data.filterDraft, region: (this.data.regionInput || '').trim() };
    if (!draft.typeLabel && !draft.priceRange && !draft.region) {
      wx.showToast({ title: '请选择筛选条件', icon: 'none' });
      return;
    }
    const activeFilters = [];
    if (draft.typeLabel) {
      activeFilters.push({ key: 'type', label: draft.typeLabel });
    }
    if (draft.priceLabel) {
      activeFilters.push({ key: 'price', label: draft.priceLabel });
    }
    if (draft.region) {
      activeFilters.push({ key: 'region', label: draft.region });
    }
    this.setData({ showFilterPanel: false, activeFilters, filterDraft: draft });
    wx.navigateTo({
      url: `/pages/category/list/list?${categoryNav.buildListQueryFromFilter(draft)}`
    });
  },

  removeActiveFilter(e) {
    const key = e.currentTarget.dataset.key;
    const draft = { ...this.data.filterDraft };
    if (key === 'type') {
      draft.l1Id = '';
      draft.typeKey = '';
      draft.typeLabel = '';
      draft.categoryId = '';
      draft.categoryTag = '';
      draft.displayZone = '';
    } else if (key === 'price') {
      draft.priceRange = '';
      draft.priceLabel = '';
    } else if (key === 'region') {
      draft.region = '';
      this.setData({ regionInput: '' });
    }
    const activeFilters = this.data.activeFilters.filter((f) => f.key !== key);
    this.setData({ filterDraft: draft, activeFilters });
  }
});
