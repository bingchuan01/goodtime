// 我的发布（项目管理）
const api = require('../../../utils/api');
const auth = require('../../../utils/auth');
const util = require('../../../utils/util');

const STATUS_MAP = {
  approved: '审核通过',
  rejected: '返回修改',
  pending: '待审核'
};

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    statusFilter: '',
    editPool: null,
    statusTabs: [
      { key: '', label: '全部' },
      { key: 'approved', label: '审核通过' },
      { key: 'rejected', label: '返回修改' },
      { key: 'pending', label: '待审核' }
    ]
  },

  onLoad() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    this.loadEditPool();
    this.loadList();
  },

  onShow() {
    if (auth.checkLogin()) {
      this.loadEditPool();
    }
    if (this.data.list.length > 0) {
      this.refreshList();
    }
  },

  loadEditPool() {
    api.getContentEditPool().then((pool) => {
      this.setData({ editPool: pool });
    }).catch(() => {});
  },

  onStatusTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.statusFilter) return;
    this.setData({
      statusFilter: key,
      list: [],
      page: 1,
      hasMore: true
    });
    this.loadList(key);
  },

  loadList(overrideStatus) {
    const isFilterChange = overrideStatus !== undefined && overrideStatus !== null;
    const status = isFilterChange ? overrideStatus : this.data.statusFilter;
    const page = isFilterChange ? 1 : this.data.page;

    if (this.data.loading || (!isFilterChange && !this.data.hasMore)) return;

    this.setData({ loading: true });
    const userInfo = auth.getUserInfo();
    api.getUserVideos(userInfo.id, page, this.data.pageSize, status)
      .then(result => {
        const rawList = result.list || [];
        const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
        const statusNorm = status ? status.trim().toLowerCase() : '';
        const filtered = statusNorm && ['approved', 'rejected', 'pending'].includes(statusNorm)
          ? rawList.filter(p => norm(p.status) === statusNorm)
          : rawList;
        const items = filtered.map(p => {
          const status = norm(p.status) || p.status || 'pending';
          const timeMeta = util.getProjectTimeMeta({ ...p, status });
          return {
            ...p,
            status,
            statusText: STATUS_MAP[status] || '待审核',
            timeLabel: timeMeta.timeLabel,
            timeDisplay: timeMeta.timeDisplay
          };
        });
        this.setData({
          list: isFilterChange ? items : [...this.data.list, ...items],
          page: page + 1,
          hasMore: rawList.length >= this.data.pageSize,
          loading: false,
          ...(isFilterChange ? { statusFilter: status } : {})
        });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  refreshList() {
    this.setData({ list: [], page: 1, hasMore: true });
    this.loadList();
  },

  onReachBottom() {
    this.loadList();
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.status === 'approved') {
      wx.navigateTo({
        url: `/pages/video-detail/video-detail?id=${item.id}`
      });
    }
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.setStorageSync('editingProjectId', String(id));
    wx.switchTab({ url: '/pages/publish/publish' });
  },

  onContentEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const pool = this.data.editPool;
    if (pool && !pool.canApply) {
      wx.showToast({ title: pool.quotaRemain <= 0 ? '改稿额度已用完' : '暂不可改稿', icon: 'none' });
      return;
    }
    wx.setStorageSync('editingProjectId', String(id));
    wx.setStorageSync('contentEditMode', '1');
    wx.switchTab({ url: '/pages/publish/publish' });
  },

  onUseCoupon(e) {
    const projectId = e.currentTarget.dataset.id;
    if (!projectId) return;
    wx.navigateTo({
      url: '/pages/points/coupons/coupons?projectId=' + projectId
    });
  },

});
