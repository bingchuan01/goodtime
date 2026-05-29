// 项目详情页
const api = require('../../utils/api');
const util = require('../../utils/util');
const memberUtil = require('../../utils/member');
const auth = require('../../utils/auth');

Page({
  data: {
    projectId: null,
    project: null,
    showContent: false, // 仅 onReady 后为 true，避免过渡动画期间渲染导致底部图片闪现
    loading: false,
    loadError: false,
    // 轮播图相关
    carouselImages: [],
    currentCarouselIndex: 0,
    // 视频相关
    videoContext: null,
    isVideoPlaying: false,
    isVideoFullscreen: false,
    // 表单相关
    formData: {
      name: '',
      phone: '',
      address: ''
    },
    showForm: false,
    isFavorited: false
  },

  onLoad(options) {
    const projectId = options.id;
    if (!projectId) {
      wx.showToast({
        title: '项目不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    const coverType = decodeURIComponent(options.coverType || 'image');
    const memberLevel = decodeURIComponent(options.memberLevel || '');
    const fromUid = options.fromUid || options.refUserId || '';
    const shareId = options.shareId || '';

    if (fromUid) {
      api.saveShareRef(fromUid, shareId);
    }

    this._shareRefUserId = fromUid ? String(fromUid) : '';
    this._shareId = shareId ? String(shareId) : '';
    this._pageEnterAt = Date.now();
    this._clickReported = false;

    this.setData({ 
      projectId,
      coverType,
      memberLevel
    });

    const prefetched = getApp().globalData.prefetchedProject;
    if (prefetched && prefetched.id === String(projectId) && prefetched.data) {
      getApp().globalData.prefetchedProject = null;
      this.applyProjectData(prefetched.data);
      this.setData({ showContent: true });
      return;
    }
    this.loadProjectDetail();
  },

  onReady() {
    this.videoContext = wx.createVideoContext('projectVideo', this);
    this.setData({ showContent: true });
  },

  onUnload() {
    this.reportShareClickIfNeeded();
  },

  reportShareClickIfNeeded() {
    if (this._clickReported) return;
    const sharerId = this._shareRefUserId;
    if (!sharerId || !auth.checkLogin()) return;
    const me = auth.getUserInfo();
    if (!me || !me.id || me.id === sharerId) return;
    const dwellSeconds = Math.floor((Date.now() - (this._pageEnterAt || Date.now())) / 1000);
    if (dwellSeconds < 5) return;
    this._clickReported = true;
    api.postGrowthShareReport({
      type: 'click',
      refUserId: sharerId,
      shareId: this._shareId || '',
      dwellSeconds
    }).catch(() => {});
  },

  applyProjectData(project) {
    if (!project) return;
    if (project.publisher && !project.publisher.avatar) {
      project.publisher.avatar = '/images/icons/default-avatar.svg';
    }
    const pubLvl = project.publisher && project.publisher.memberLevel;
    const publisherMemberBadgeClass = memberUtil.getMemberBadgeClass(pubLvl);
    const algoTags = project.algoTags || [];
    const isFavorited = !!project.isFavorited;
    if (project.memberLevel === 'V8' && project.coverType === 'video' && project.videoUrl) {
      this.setData({
        project: { ...project, displayType: 'video', publisherMemberBadgeClass, algoTags },
        isFavorited,
        loading: false
      });
    } else {
      this.setData({
        project: {
          ...project,
          displayType: 'carousel',
          carouselImages: project.carouselImages || [],
          publisherMemberBadgeClass,
          algoTags
        },
        carouselImages: project.carouselImages || [],
        isFavorited,
        loading: false
      });
    }
  },

  // 加载项目详情（对接 API），无预取数据时调用
  async loadProjectDetail(isRetry) {
    try {
      this.setData({ loading: true, loadError: false });
      if (!isRetry) wx.showLoading({ title: '加载中...' });
      const project = await api.getProjectDetail(this.data.projectId);
      if (!project) {
        wx.showToast({ title: '项目不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      this.applyProjectData(project);
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      if (!isRetry) {
        setTimeout(() => this.loadProjectDetail(true), 500);
      } else {
        this.setData({ loading: false, loadError: true });
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }
  },

  onRetryLoad() {
    this.loadProjectDetail();
  },

  // 轮播图切换
  onCarouselChange(e) {
    this.setData({
      currentCarouselIndex: e.detail.current
    });
  },

  // 视频播放
  onVideoPlay() {
    this.setData({ isVideoPlaying: true });
  },

  // 视频暂停
  onVideoPause() {
    this.setData({ isVideoPlaying: false });
  },

  // 视频播放结束
  onVideoEnded() {
    this.setData({ isVideoPlaying: false });
  },

  // 视频全屏
  onVideoFullscreen(e) {
    this.setData({ isVideoFullscreen: e.detail.fullscreen });
  },

  // 头像加载失败，使用默认头像
  onAvatarError(e) {
    const defaultAvatar = '/images/icons/default-avatar.svg';
    if (this.data.project && this.data.project.publisher && this.data.project.publisher.avatar !== defaultAvatar) {
      this.setData({
        'project.publisher.avatar': defaultAvatar
      });
    }
  },


  // 发送私信 -> 跳转写站内信页，预填收件人（项目发布者）
  onSendMessage() {
    const { project } = this.data;
    if (!project || !project.publisher) {
      wx.navigateTo({ url: '/pages/message-list/message-list' });
      return;
    }
    const recipientId = project.publisher.id || `pub_${project.id}`;
    const recipientName = project.publisher.nickname || '';
    wx.navigateTo({
      url: `/pages/message-compose/message-compose?recipientId=${encodeURIComponent(recipientId)}&recipientName=${encodeURIComponent(recipientName)}&projectId=${encodeURIComponent(project.id)}`
    });
  },

  async onToggleFavorite() {
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    try {
      const res = await api.toggleProjectFavorite(this.data.projectId);
      const favorited = !!(res && res.favorited);
      this.setData({ isFavorited: favorited, 'project.isFavorited': favorited });
      wx.showToast({ title: favorited ? '已收藏' : '已取消', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 合作咨询
  onCooperationConsult() {
    wx.showToast({
      title: '正在打开客服系统',
      icon: 'none'
    });
    // TODO: 嵌入第三方在线客服系统（轻量级）
  },

  // 免费获取品牌资料 - 显示表单
  onShowForm() {
    this.setData({ showForm: true });
  },

  // 关闭表单
  onCloseForm() {
    this.setData({ showForm: false });
  },

  // 阻止冒泡：点击表单区域时不关闭弹窗，便于在输入框中录入
  onPreventClose() {},


  // 表单输入
  onFormInput(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 提交表单
  async onSubmitForm() {
    const { formData, projectId } = this.data;
    if (!formData.name || !formData.phone) {
      wx.showToast({ title: '请填写姓名和电话', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      await api.submitLead({
        projectId,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: (formData.address || '').trim()
      });
      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({ showForm: false, formData: { name: '', phone: '', address: '' } });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: (e && e.message) || '提交失败', icon: 'none' });
    }
  },

  // 格式化数字
  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  },

  buildSharePath() {
    const id = this.data.projectId;
    let path = `/pages/video-detail/video-detail?id=${id}`;
    if (auth.checkLogin()) {
      const me = auth.getUserInfo();
      const shareId = `${me && me.id ? me.id : 'u'}_${Date.now()}`;
      this._pendingShareId = shareId;
      if (me && me.id) {
        path += `&fromUid=${encodeURIComponent(me.id)}&shareId=${encodeURIComponent(shareId)}`;
      }
    }
    return path;
  },

  // 分享
  onShareAppMessage() {
    const path = this.buildSharePath();
    if (this.data.projectId) {
      api.reportProjectShare(this.data.projectId).catch(() => {});
    }
    if (auth.checkLogin()) {
      const me = auth.getUserInfo();
      if (me && me.id) {
        api.postGrowthShareReport({
          type: 'share',
          shareId: this._pendingShareId || ''
        }).catch(() => {});
      }
    }
    return {
      title: (this.data.project && this.data.project.title) || '分享项目',
      path
    };
  }
});
