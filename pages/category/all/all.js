const api = require('../../../utils/api');

function buildLeftNavFromGroups(groups) {
  const items = [];
  (groups || []).forEach((group) => {
    if (group.noL3 && group.zoneId) {
      items.push({
        key: group.id,
        label: group.name,
        directZone: group.zoneId,
        groupName: group.name
      });
      return;
    }
    const industryGroup = (groups || []).find((g) => g.id === 'industries');
    (group.children || []).forEach((child) => {
      const industryTags = industryGroup?.children?.find((c) => c.id === child.id)?.tags;
      items.push({
        key: `${group.id}_${child.id}`,
        label: child.name,
        categoryId: child.id,
        zoneId: group.type === 'zone' ? group.zoneId : '',
        groupName: group.name,
        tags: child.tags && child.tags.length ? child.tags : (industryTags || [])
      });
    });
  });
  return items;
}

Page({
  data: {
    leftNav: [],
    selectedKey: '',
    selectedItem: null,
    rightTags: []
  },

  onLoad() {
    this.loadNav();
  },

  async loadNav() {
    try {
      const data = await api.getCategoryNav();
      const groups = data && data.groups ? data.groups : [];
      const leftNav = buildLeftNavFromGroups(groups);
      const first = leftNav[0] || null;
      this.setData({
        leftNav,
        selectedKey: first ? first.key : '',
        selectedItem: first,
        rightTags: first ? (first.tags || []) : []
      });
    } catch (e) {
      const categoryNav = require('../../../utils/categoryNav');
      const leftNav = categoryNav.buildLeftNav();
      const first = leftNav[0] || null;
      this.setData({
        leftNav,
        selectedKey: first ? first.key : '',
        selectedItem: first,
        rightTags: first ? (first.tags || []) : []
      });
    }
  },

  onLeftTap(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.leftNav.find((i) => i.key === key);
    if (!item) return;
    if (item.directZone) {
      wx.navigateTo({
        url: `/pages/category/list/list?displayZone=${encodeURIComponent(item.directZone)}&title=${encodeURIComponent(item.label)}`
      });
      return;
    }
    this.setData({
      selectedKey: key,
      selectedItem: item,
      rightTags: item.tags || []
    });
  },

  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    const item = this.data.selectedItem;
    if (!item || !tag) return;
    const qs = [
      `categoryId=${encodeURIComponent(item.categoryId || '')}`,
      `categoryTag=${encodeURIComponent(tag)}`,
      `title=${encodeURIComponent(tag)}`
    ];
    if (item.zoneId) qs.push(`displayZone=${encodeURIComponent(item.zoneId)}`);
    wx.navigateTo({ url: `/pages/category/list/list?${qs.join('&')}` });
  },

  onTop50Tap() {
    wx.navigateTo({ url: '/pages/category/top50/top50' });
  },

  onBrowseAll() {
    const item = this.data.selectedItem;
    if (!item || item.directZone) return;
    const qs = [
      `categoryId=${encodeURIComponent(item.categoryId || '')}`,
      `title=${encodeURIComponent(item.label)}`
    ];
    if (item.zoneId) qs.push(`displayZone=${encodeURIComponent(item.zoneId)}`);
    wx.navigateTo({ url: `/pages/category/list/list?${qs.join('&')}` });
  }
});
