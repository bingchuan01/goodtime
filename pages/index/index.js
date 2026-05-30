// index.js
const api = require('../../utils/api');
const categoriesUtil = require('../../utils/categories');
const dashboardIconSvg = require('../../utils/dashboardIconSvg');

const DASHBOARD_SHOW_MS = 1500;
const DASHBOARD_ANIM_MS = 450;

Page({
  data: {
    dashboardData: [
      { key: 'marketSize', label: '市场规模', value: '8万亿', icon: '/images/icons/chart.svg', iconBgColor: '#E3F2FD' },
      { key: 'serviceMerchants', label: '服务商家', value: '3630', icon: '/images/icons/shop.svg', iconBgColor: '#FFF9C4' },
      { key: 'strategicPartners', label: '战略合作', value: '13家', icon: '/images/icons/handshake.svg', iconBgColor: '#F5F5F5' },
      { key: 'marketShare', label: '市场份额', value: '0.03', icon: '/images/icons/pie-chart.svg', iconBgColor: '#FCE4EC' },
      { key: 'registeredUsers', label: '注册用户', value: '73.7万', icon: '/images/icons/users.svg', iconBgColor: '#FFF9C4' }
    ],
    dashboardCollapsed: true,
    dashboardNoTransition: false,
    carouselList: [],
    categoryList: categoriesUtil.DEFAULT_CATEGORIES,
    currentCategoryId: 'hot',
    projectList: [],
    projectColumns: [[], []],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    refreshing: false,
    loadError: false
  },

  onLoad() {
    this._projectsBootstrapped = false;
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#1a1a24' });
    try {
      const app = getApp();
      if (app) {
        app._notifyHomeDashboardIntro = () => this._tryConsumeDashboardIntro();
      }
    } catch (e) {
      /* ignore */
    }
    this.setData({
      dashboardData: dashboardIconSvg.applyInlineIcons(this.data.dashboardData),
      dashboardCollapsed: true
    });
    this.loadCategories();
    this.loadDashboard();
    this.loadHomeCarousel();
    this.loadProjects(true);
  },

  onShow() {
    this._pageVisible = true;
    this.loadCategories();
    if (this._hasDashboardIntroPending() && !this._shouldSkipLaunchIntro()) {
      this.setData({ dashboardCollapsed: false, dashboardNoTransition: true });
    }
    if (this._deferDashboardIntro) {
      this._deferDashboardIntro = false;
    }
    this._scheduleTryConsumeDashboardIntro();
    if (this._projectsBootstrapped && !this.data.loading && this.data.projectList.length === 0 && !this.data.loadError) {
      this.loadProjects(true);
    }
  },

  onHide() {
    this._pageVisible = false;
  },

  _scheduleTryConsumeDashboardIntro() {
    if (!this._pageVisible) {
      this._deferDashboardIntro = true;
      return;
    }
    if (this._dashboardAnimating) return;
    const delay = 120;
    if (this._introScheduleTimer) {
      clearTimeout(this._introScheduleTimer);
    }
    this._introScheduleTimer = setTimeout(() => {
      this._introScheduleTimer = null;
      if (!this._pageVisible) return;
      if (this._deferDashboardIntro) {
        this._deferDashboardIntro = false;
      }
      this._tryConsumeDashboardIntro();
    }, delay);
  },

  _hasDashboardIntroPending() {
    let pending = false;
    try {
      pending = !!wx.getStorageSync('homeDashboardIntro');
    } catch (e) {
      /* ignore */
    }
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.homeDashboardIntroPending) {
        pending = true;
      }
    } catch (e) {
      /* ignore */
    }
    return pending;
  },

  _clearIntroFlags() {
    try {
      wx.removeStorageSync('homeDashboardIntro');
    } catch (e) {
      /* ignore */
    }
    try {
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.homeDashboardIntroPending = false;
        app.globalData.homeDashboardIntroKind = null;
      }
    } catch (e) {
      /* ignore */
    }
  },

  _shouldSkipLaunchIntro() {
    try {
      const app = getApp();
      if (!app || !app.globalData) return false;
      return (
        app.globalData.homeDashboardIntroKind === 'launch' &&
        app.globalData.homeDashboardLaunchIntroPlayed
      );
    } catch (e) {
      return false;
    }
  },

  _tryConsumeDashboardIntro() {
    if (!this._pageVisible) {
      this._deferDashboardIntro = true;
      return false;
    }
    if (!this._hasDashboardIntroPending()) return false;
    if (this._shouldSkipLaunchIntro()) return false;
    this._runDashboardReveal();
    return true;
  },

  /** 引导页/登录回首页时由 auth 主动调用；若页面尚未显示则延后到 onShow */
  triggerDashboardIntro() {
    if (!this._pageVisible) {
      this._deferDashboardIntro = true;
      return;
    }
    if (this._dashboardAnimating) return;
    if (this._shouldSkipLaunchIntro()) return;
    if (!this._hasDashboardIntroPending()) {
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.homeDashboardIntroPending = true;
          if (!app.globalData.homeDashboardIntroKind) {
            app.globalData.homeDashboardIntroKind = 'launch';
          }
        }
      } catch (e) {
        /* ignore */
      }
    }
    this._runDashboardReveal();
  },

  onUnload() {
    this._clearDashboardTimers();
    if (this._introScheduleTimer) {
      clearTimeout(this._introScheduleTimer);
      this._introScheduleTimer = null;
    }
    try {
      const app = getApp();
      if (app && app._notifyHomeDashboardIntro) {
        app._notifyHomeDashboardIntro = null;
      }
    } catch (e) {
      /* ignore */
    }
  },

  _clearDashboardTimers() {
    if (this._dashboardRevealTimer) {
      clearTimeout(this._dashboardRevealTimer);
      this._dashboardRevealTimer = null;
    }
    if (this._dashboardShowTimer) {
      clearTimeout(this._dashboardShowTimer);
      this._dashboardShowTimer = null;
    }
    if (this._dashboardHideTimer) {
      clearTimeout(this._dashboardHideTimer);
      this._dashboardHideTimer = null;
    }
  },

  /** 先全屏展示看板 1.5s，再上滑收起露出轮播（须在首页已显示时调用） */
  _runDashboardReveal() {
    if (!this._pageVisible) {
      this._deferDashboardIntro = true;
      return;
    }
    if (this._dashboardAnimating) return;
    this._clearDashboardTimers();
    this._dashboardAnimating = true;
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.homeDashboardIntroKind === 'launch') {
        app.globalData.homeDashboardLaunchIntroPlayed = true;
      }
    } catch (e) {
      /* ignore */
    }
    this._clearIntroFlags();

    this.setData(
      {
        dashboardCollapsed: false,
        dashboardNoTransition: true
      },
      () => {
        this._dashboardRevealTimer = setTimeout(() => {
          this.setData({ dashboardNoTransition: false }, () => {
            this._dashboardShowTimer = setTimeout(() => {
              this.setData({ dashboardCollapsed: true });
              this._dashboardHideTimer = setTimeout(() => {
                this._dashboardAnimating = false;
              }, DASHBOARD_ANIM_MS);
            }, DASHBOARD_SHOW_MS);
          });
        }, 50);
      }
    );
  },

  onExpandDashboard() {
    if (this._dashboardAnimating) return;
    this._runDashboardReveal();
  },

  async loadHomeCarousel() {
    try {
      const data = await api.getConfig('home_carousel');
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      }
      list = list
        .filter((item) => item && (item.cover || item.image))
        .slice(0, 6)
        .map((item, index) => ({
          id: item.id || index + 1,
          title: item.title || '',
          cover: item.cover || item.image || '',
          link: item.link || ''
        }));
      this.setData({ carouselList: list });
    } catch (e) {
      this.setData({ carouselList: [] });
    }
  },

  onHomeCarouselTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.carouselList[index];
    if (!item || !item.link) return;
    wx.showModal({
      title: '打开链接',
      content: '是否复制链接到剪贴板？',
      confirmText: '复制',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: item.link,
            success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
          });
        }
      }
    });
  },

  async loadDashboard() {
    try {
      const data = await api.getConfig('dashboard');
      if (data && typeof data === 'object') {
        const labels = {
          marketSize: '市场规模',
          serviceMerchants: '服务商家',
          strategicPartners: '战略合作',
          marketShare: '市场份额',
          registeredUsers: '注册用户'
        };
        const icons = {
          marketSize: '/images/icons/chart.svg',
          serviceMerchants: '/images/icons/shop.svg',
          strategicPartners: '/images/icons/handshake.svg',
          marketShare: '/images/icons/pie-chart.svg',
          registeredUsers: '/images/icons/users.svg'
        };
        const colors = {
          marketSize: '#E3F2FD',
          serviceMerchants: '#FFF9C4',
          strategicPartners: '#F5F5F5',
          marketShare: '#FCE4EC',
          registeredUsers: '#FFF9C4'
        };
        const dashboardData = dashboardIconSvg.applyInlineIcons(
          Object.keys(labels).map((key) => ({
            key,
            label: labels[key],
            value: data[key] ?? '',
            icon: icons[key],
            iconBgColor: colors[key]
          }))
        );
        this.setData({ dashboardData });
      }
    } catch (e) {
      /* ignore */
    }
  },

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

  _buildProjectColumns(list) {
    const columns = [[], []];
    (list || []).forEach((project, index) => {
      columns[index % 2].push(project);
    });
    return columns;
  },

  _buildListQuery(categoryId) {
    const cid = categoryId || this.data.currentCategoryId;
    const isZone = ['hot', 'trend', 'new'].includes(cid);
    const query = {
      pageSize: this.data.pageSize
    };
    if (isZone) {
      query.displayZone = cid;
    } else {
      query.categoryId = cid;
    }
    return query;
  },

  async loadProjects(force) {
    if (!force && (this.data.loading || !this.data.hasMore)) return;
    this._loadSeq = (this._loadSeq || 0) + 1;
    const seq = this._loadSeq;
    const page = force ? 1 : this.data.page;
    this.setData({ loading: true, loadError: false });
    try {
      const res = await api.getProjectList({
        page,
        ...this._buildListQuery()
      });
      if (seq !== this._loadSeq) return;
      const list = res && res.list ? res.list : [];
      const hasMore = res && res.hasMore !== false;
      const projectList = (force || page <= 1) ? list : [...this.data.projectList, ...list];
      this._projectsBootstrapped = true;
      this.setData({
        projectList,
        projectColumns: this._buildProjectColumns(projectList),
        page: page + 1,
        hasMore,
        loading: false,
        loadError: false
      });
    } catch (e) {
      if (seq !== this._loadSeq) return;
      this.setData({ loading: false, loadError: true });
    }
  },

  onRetryProjects() {
    this.setData({
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true,
      loadError: false
    }, () => {
      this.loadProjects(true);
    });
  },

  onRefresh() {
    this.setData({
      refreshing: true,
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true,
      loadError: false
    });
    this.loadHomeCarousel();
    setTimeout(() => {
      this.loadProjects(true);
      this.setData({ refreshing: false });
    }, 800);
  },

  onLoadMore() {
    this.loadProjects();
  },

  onAllProjectsTap() {
    wx.navigateTo({ url: '/pages/category/all/all' });
  },

  onCategoryChange(e) {
    const { categoryId } = e.detail;
    if (categoryId === this.data.currentCategoryId) return;
    this.setData({
      currentCategoryId: categoryId,
      page: 1,
      projectList: [],
      projectColumns: [[], []],
      hasMore: true,
      loadError: false
    }, () => {
      this.loadProjects(true);
    });
  },

  onSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  onLocationChange() {
    /* 位置已写入本地/服务端画像，后续推荐与统计可在此扩展 */
  },

  async onProjectTap(e) {
    const { projectId, project } = e.detail;
    if (!projectId) return;
    const coverType = (project && project.coverType) || 'image';
    const memberLevel = (project && project.memberLevel) || '';
    wx.showLoading({ title: '加载中...' });
    try {
      const detail = await api.getProjectDetail(projectId);
      getApp().globalData.prefetchedProject = { id: String(projectId), data: detail };
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/video-detail/video-detail?id=${projectId}&coverType=${encodeURIComponent(coverType)}&memberLevel=${encodeURIComponent(memberLevel)}`
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  }
});
