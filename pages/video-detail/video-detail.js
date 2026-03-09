// 项目详情页
const api = require('../../utils/api');
const util = require('../../utils/util');

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
    showForm: false
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

    this.setData({ 
      projectId,
      coverType,
      memberLevel
    });

    const prefetched = getApp().globalData.prefetchedProject;
    if (prefetched && prefetched.id === String(projectId) && prefetched.data) {
      getApp().globalData.prefetchedProject = null;
      this.applyProjectData(prefetched.data);
      return;
    }
    this.loadProjectDetail();
  },

  onReady() {
    this.videoContext = wx.createVideoContext('projectVideo', this);
    // 延迟至过渡动画结束后再显示内容，避免底部详情图在切换时闪现
    setTimeout(() => {
      this.setData({ showContent: true });
    }, 350);
  },

  applyProjectData(project) {
    if (!project) return;
    if (project.publisher && !project.publisher.avatar) {
      project.publisher.avatar = '/images/icons/default-avatar.svg';
    }
    if (project.memberLevel === 'V8' && project.coverType === 'video' && project.videoUrl) {
      this.setData({
        project: { ...project, displayType: 'video' },
        loading: false
      });
    } else {
      this.setData({
        project: { ...project, displayType: 'carousel', carouselImages: project.carouselImages || [] },
        carouselImages: project.carouselImages || [],
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
      url: `/pages/message-compose/message-compose?recipientId=${encodeURIComponent(recipientId)}&recipientName=${encodeURIComponent(recipientName)}`
    });
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
    const { name, phone, address } = this.data.formData;
    
    if (!name || !name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }
    
    if (!phone || !phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }
    
    // 简单的手机号验证
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }
    
    if (!address || !address.trim()) {
      wx.showToast({
        title: '请输入收件地址',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      await api.submitLead(this.data.projectId, {
        name: name.trim(),
        phone: phone.trim(),
        address: (address || '').trim()
      });
      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({
        showForm: false,
        formData: { name: '', phone: '', address: '' }
      });
    } catch (e) {
      wx.hideLoading();
    }
  },

  // 格式化数字
  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: (this.data.project && this.data.project.title) || '分享项目',
      path: `/pages/video-detail/video-detail?id=${this.data.projectId}`
    };
  }
});
