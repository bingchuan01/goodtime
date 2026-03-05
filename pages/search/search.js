// 搜索页：标题/品牌/行业模糊匹配、联想词、历史记录、筛选标签
const searchHelper = require('../../utils/searchHelper');
const api = require('../../utils/api');
const categoriesUtil = require('../../utils/categories');

Page({
  data: {
    keyword: '',
    suggestions: [],
    showSuggestions: false,
    historyList: [],
    categoryList: categoriesUtil.DEFAULT_CATEGORIES.map(c => ({ ...c, active: false })),
    filterTags: [],
    resultList: [],
    loading: false,
    searched: false
  },

  onLoad() {
    this.loadCategories();
    this.loadHistory();
  },

  onShow() {
    this.loadCategories();
    this.loadHistory();
  },

  async loadCategories() {
    try {
      const res = await api.getCategories();
      const list = Array.isArray(res) ? res : (res?.list || res?.data || []);
      const baseList = categoriesUtil.normalizeList(list);
      this._updateCategoryList(baseList);
    } catch (e) {
      this._updateCategoryList(categoriesUtil.DEFAULT_CATEGORIES);
    }
  },

  _updateCategoryList(baseList) {
    const tags = this.data.filterTags || [];
    const activeIds = tags.filter(t => t.type === 'category').map(t => t.id);
    const categoryList = baseList.map(c => ({
      ...c,
      active: activeIds.indexOf(c.id) >= 0
    }));
    this.setData({ categoryList });
  },

  loadHistory() {
    const list = searchHelper.getHistory();
    this.setData({ historyList: list });
  },

  onInput(e) {
    const keyword = (e.detail && e.detail.value) || '';
    const suggestions = searchHelper.getSuggestions(keyword);
    this.setData({
      keyword,
      suggestions,
      showSuggestions: keyword.length > 0
    });
  },

  onFocus() {
    const { keyword } = this.data;
    this.setData({
      showSuggestions: keyword.length > 0,
      suggestions: searchHelper.getSuggestions(keyword)
    });
  },

  onBlur() {
    setTimeout(() => {
      this.setData({ showSuggestions: false });
    }, 200);
  },

  onSuggestionTap(e) {
    const word = e.currentTarget.dataset.word;
    this.setData({ keyword: word, showSuggestions: false });
    this.doSearch(word);
  },

  onHistoryTap(e) {
    const word = e.currentTarget.dataset.word;
    this.setData({ keyword: word });
    this.doSearch(word);
  },

  onHistoryDelete(e) {
    const word = e.currentTarget.dataset.word;
    searchHelper.removeHistoryItem(word);
    this.loadHistory();
  },

  onClearHistory() {
    searchHelper.clearHistory();
    this.setData({ historyList: [] });
  },

  onSearch() {
    const { keyword } = this.data;
    const k = (keyword || '').trim();
    if (!k) return;
    this.doSearch(k);
  },

  doSearch(keyword) {
    const k = (keyword || this.data.keyword || '').trim();
    if (!k) return;
    searchHelper.saveToHistory(k);
    this.loadHistory();
    this.setData({ showSuggestions: false, searched: true });
    this.searchProjects(k);
  },

  async searchProjects(keyword) {
    this.setData({ loading: true });
    const tags = [...this.data.filterTags];
    const categoryIds = tags.filter(t => t.type === 'category').map(t => t.id);
    try {
      const res = await api.searchProjects({
        keyword: (keyword || this.data.keyword || '').trim(),
        categoryIds: categoryIds.length ? categoryIds : undefined,
        page: 1,
        pageSize: 50
      });
      const list = (res && res.list) ? res.list : [];
      this.setData({ resultList: list, loading: false });
    } catch (e) {
      this.setData({ resultList: [], loading: false });
    }
  },

  onAddFilter(e) {
    const { id, name } = e.currentTarget.dataset;
    let tags = [...this.data.filterTags];
    const idx = tags.findIndex(t => t.id === id && t.type === 'category');
    if (idx >= 0) {
      tags.splice(idx, 1);
    } else {
      tags.push({ id, name, type: 'category' });
    }
    this._updateFilterState(tags);
    if (this.data.searched) this.searchProjects(this.data.keyword);
  },

  onRemoveFilterTag(e) {
    const { id, type } = e.currentTarget.dataset;
    const tags = this.data.filterTags.filter(t => !(t.id === id && t.type === type));
    this._updateFilterState(tags);
    if (this.data.searched) this.searchProjects(this.data.keyword);
  },

  onClearAllFilters() {
    this._updateFilterState([]);
    if (this.data.searched) this.searchProjects(this.data.keyword);
  },

  _updateFilterState(tags) {
    const activeIds = tags.filter(t => t.type === 'category').map(t => t.id);
    const baseList = this.data.categoryList.map(({ id, name, icon }) => ({ id, name, icon }));
    const categoryList = baseList.map(c => ({
      ...c,
      active: activeIds.indexOf(c.id) >= 0
    }));
    this.setData({ filterTags: tags, categoryList });
  },

  onProjectTap(e) {
    const { projectId } = e.detail;
    wx.navigateTo({
      url: `/pages/video-detail/video-detail?id=${projectId}`
    });
  },

  onClearKeyword() {
    this.setData({
      keyword: '',
      suggestions: [],
      showSuggestions: false,
      resultList: [],
      searched: false
    });
  }
});
