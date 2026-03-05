// index.js
const api = require('../../utils/api');
const categoriesUtil = require('../../utils/categories');

Page({
  data: {
    // 数据看板（默认 + 后台可覆盖）
    dashboardData: [
      { key: 'marketSize', label: '市场规模', value: '8万亿', icon: '/images/icons/chart.svg', iconBgColor: '#E3F2FD' },
      { key: 'serviceMerchants', label: '服务商家', value: '3630', icon: '/images/icons/shop.svg', iconBgColor: '#FFF9C4' },
      { key: 'strategicPartners', label: '战略合作', value: '13家', icon: '/images/icons/handshake.svg', iconBgColor: '#F5F5F5' },
      { key: 'marketShare', label: '市场份额', value: '0.03', icon: '/images/icons/pie-chart.svg', iconBgColor: '#FCE4EC' },
      { key: 'registeredUsers', label: '注册用户', value: '73.7万', icon: '/images/icons/users.svg', iconBgColor: '#FFF9C4' }
    ],
    // 分类列表（从后台拉取，失败用默认）
    categoryList: categoriesUtil.DEFAULT_CATEGORIES,
    currentCategoryId: 'hot',
    // 项目列表
    projectList: [],
    // 瀑布流列数据
    projectColumns: [[], []],
    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    refreshing: false,
    // 项目列表加载失败（用于展示空状态+重试）
    loadError: false
  },
  
  onLoad(options) {
    this.loadCategories();
    this.loadDashboard();
    this.loadProjects();
  },

  onShow() {
    this.loadCategories();
  },

  async loadDashboard() {
    try {
      const data = await api.getConfig('dashboard');
      if (data && typeof data === 'object') {
        const labels = { marketSize: '市场规模', serviceMerchants: '服务商家', strategicPartners: '战略合作', marketShare: '市场份额', registeredUsers: '注册用户' };
        const icons = { marketSize: '/images/icons/chart.svg', serviceMerchants: '/images/icons/shop.svg', strategicPartners: '/images/icons/handshake.svg', marketShare: '/images/icons/pie-chart.svg', registeredUsers: '/images/icons/users.svg' };
        const colors = { marketSize: '#E3F2FD', serviceMerchants: '#FFF9C4', strategicPartners: '#F5F5F5', marketShare: '#FCE4EC', registeredUsers: '#FFF9C4' };
        const dashboardData = Object.keys(labels).map(key => ({
          key,
          label: labels[key],
          value: data[key] ?? '',
          icon: icons[key],
          iconBgColor: colors[key]
        }));
        this.setData({ dashboardData });
      }
    } catch (e) {}
  },

  // 加载项目分类（后台可添加/删除）
  async loadCategories() {
    try {
      const res = await api.getCategories();
      const list = Array.isArray(res) ? res : (res?.list || res?.data || []);
      const normalized = categoriesUtil.normalizeList(list);
      this.setData({ categoryList: normalized });
    } catch (e) {
      this.setData({ categoryList: categoriesUtil.DEFAULT_CATEGORIES });
    }
  },
  
  // 加载项目列表（对接 API，失败时不弹 toast，由空状态+重试展示）
  async loadProjects() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true, loadError: false });
    try {
      const cid = this.data.currentCategoryId;
      const isZone = ['hot', 'trend', 'new'].includes(cid);
      const res = await api.getProjectList({
        page: this.data.page,
        pageSize: this.data.pageSize,
        categoryId: isZone ? '' : cid,
        displayZone: isZone ? cid : ''
      });
      const list = res && res.list ? res.list : [];
      const hasMore = res && res.hasMore !== false;
      const newColumns = [[...this.data.projectColumns[0]], [...this.data.projectColumns[1]]];
      list.forEach((project, index) => {
        const columnIndex = (this.data.projectList.length + index) % 2;
        newColumns[columnIndex].push(project);
      });
      this.setData({
        projectList: [...this.data.projectList, ...list],
        projectColumns: newColumns,
        page: this.data.page + 1,
        hasMore,
        loading: false,
        loadError: false
      });
    } catch (e) {
      this.setData({ loading: false, loadError: true });
    }
  },

  // 重试加载项目列表（空状态点击重试）
  onRetryProjects() {
    this.setData({
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true,
      loadError: false
    });
    this.loadProjects();
  },
  
  // 下拉刷新
  onRefresh() {
    this.setData({
      refreshing: true,
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true,
      loadError: false
    });
    setTimeout(() => {
      this.loadProjects();
      this.setData({ refreshing: false });
    }, 800);
  },
  
  // 上拉加载更多
  onLoadMore() {
    this.loadProjects()
  },
  
  // 分类切换
  onCategoryChange(e) {
    const { categoryId } = e.detail
    this.setData({
      currentCategoryId: categoryId,
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true
    })
    this.loadProjects()
  },
  
  // 搜索
  onSearch() {
    // 跳转到搜索页面
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },
  
  // 项目卡片点击（project 由 project-card 传入，用于详情页判断展示类型）
  onProjectTap(e) {
    const { projectId, project } = e.detail;
    const coverType = (project && project.coverType) || 'image';
    const memberLevel = (project && project.memberLevel) || '';
    wx.navigateTo({
      url: `/pages/video-detail/video-detail?id=${projectId}&coverType=${encodeURIComponent(coverType)}&memberLevel=${encodeURIComponent(memberLevel)}`
    });
  }
});
