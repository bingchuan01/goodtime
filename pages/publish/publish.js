// 项目发布页
const api = require('../../utils/api');
const auth = require('../../utils/auth');
const permission = require('../../utils/permission');
const util = require('../../utils/util');
const categoriesUtil = require('../../utils/categories');

Page({
  data: {
    // 发布类型：'flash' (V6闪电发布) 或 'advanced' (V8高级发布)
    publishType: 'flash',
    // 用户会员等级
    memberLevel: '',
    
    // 上传方式：'carousel' (轮播图) 或 'video' (视频) - 仅V8高级发布
    uploadType: 'carousel',
    
    // 轮播图相关
    carouselImages: [], // 轮播图列表，最多3张
    carouselCoverIndex: 0, // 封面索引
    
    // 视频相关（V8高级发布）
    videoPath: '',
    videoDuration: 0,
    videoCoverPath: '', // 视频封面
    
    // 表单数据
    title: '',
    introduction: '', // 介绍
    categoryTag: '', // 项目分类标签
    categoryTagId: '', // 分类ID
    storeCount: '', // 门店数
    ipAddress: '', // IP地址（城市）
    baseAmount: '', // 合作金额-基本额
    maxAmount: '', // 合作金额-最大额
    detailImages: [], // 详情页图片，最多9张
    agreementImage: '', // 入驻协议图片
    
    // 编辑态：从「我的发布」进入编辑时的项目 id；提交时走更新接口
    editingProjectId: '',
    editingDetailContent: '', // 编辑时保留原详情 HTML
    editingVideoUrl: '',
    editingVideoPoster: '',
    
    // UI状态
    showCategoryPicker: false, // 显示分类选择器
    uploading: false,
    
    // 项目分类列表（从后台拉取，失败用默认）
    categoryList: categoriesUtil.DEFAULT_CATEGORIES.map(c => ({ id: c.id, name: c.name }))
  },

  onShow() {
    const editingId = wx.getStorageSync('editingProjectId');
    if (editingId) {
      wx.removeStorageSync('editingProjectId');
      this.loadProjectForEdit(editingId);
    }
  },

  onLoad() {
    // 检查登录
    if (!auth.checkLogin()) {
      auth.requireLogin(() => {
        wx.navigateBack();
      });
      return;
    }

    // 获取用户会员等级
    const userInfo = wx.getStorageSync('userInfo') || {};
    const memberLevel = userInfo.memberLevel || '';
    
    // 根据会员等级设置默认发布类型
    let defaultType = 'flash';
    if (memberLevel === 'V8') {
      defaultType = 'advanced';
    } else if (memberLevel !== 'V6') {
      // 非V6/V8会员，提示需要会员
      wx.showModal({
        title: '提示',
        content: '发布项目需要V6或V8会员权限，是否前往开通？',
        confirmText: '去开通',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/member/benefits/benefits'
            });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    this.setData({
      memberLevel: memberLevel,
      publishType: defaultType
    });
    this.loadCategories();
  },

  async loadCategories() {
    try {
      const res = await api.getCategories();
      const list = Array.isArray(res) ? res : (res?.list || res?.data || []);
      const normalized = categoriesUtil.normalizeList(list);
      this.setData({
        categoryList: normalized.map(c => ({ id: c.id, name: c.name }))
      });
    } catch (e) {
      this.setData({
        categoryList: categoriesUtil.DEFAULT_CATEGORIES.map(c => ({ id: c.id, name: c.name }))
      });
    }
  },

  /** 加载被退回的项目用于编辑（从「我的发布」带 editingProjectId 进入时调用） */
  async loadProjectForEdit(projectId) {
    if (!auth.checkLogin()) return;
    wx.showLoading({ title: '加载中...' });
    try {
      const detail = await api.getProjectDetail(projectId);
      const d = detail && (detail.data || detail) || {};
      const coverType = (d.coverType || d.cover_type || 'carousel').toLowerCase();
      const isVideo = coverType === 'video';
      const publishType = this.data.memberLevel === 'V8' ? 'advanced' : 'flash';
      const carouselImages = Array.isArray(d.carouselImages) ? d.carouselImages : (d.carousel_images ? (typeof d.carousel_images === 'string' ? (() => { try { return JSON.parse(d.carousel_images); } catch (e) { return []; } })() : d.carousel_images) : []);
      this.setData({
        editingProjectId: String(projectId),
        editingDetailContent: d.detailContent || d.detail_content || '',
        editingVideoUrl: d.videoUrl || d.video_url || '',
        editingVideoPoster: d.videoPoster || d.video_poster || '',
        title: d.title || '',
        introduction: d.introduction || '',
        categoryTag: d.categoryTag || d.category_tag || '',
        categoryTagId: (d.categoryId || d.category_id || '').toString(),
        storeCount: String(d.storeCount || d.store_count || ''),
        ipAddress: d.ipAddress || d.ip_address || '',
        baseAmount: String(d.baseAmount || d.base_amount || ''),
        maxAmount: String(d.maxAmount || d.max_amount || ''),
        publishType,
        uploadType: isVideo ? 'video' : 'carousel',
        carouselImages: isVideo ? [] : carouselImages,
        carouselCoverIndex: 0,
        videoPath: isVideo ? (d.videoUrl || d.video_url || '') : '',
        videoDuration: 0,
        videoCoverPath: isVideo ? (d.videoPoster || d.video_poster || '') : '',
        detailImages: []
      });
    } catch (e) {
      wx.showToast({ title: e && e.message ? e.message : '加载失败', icon: 'none' });
      this.setData({ editingProjectId: '' });
    } finally {
      wx.hideLoading();
    }
  },

  // 切换发布类型
  onPublishTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'advanced' && this.data.memberLevel !== 'V8') {
      wx.showToast({
        title: '高级发布需要V8会员',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      publishType: type,
      uploadType: 'carousel', // 切换时重置上传方式
      carouselImages: [],
      videoPath: '',
      videoCoverPath: ''
    });
  },

  // 切换上传方式（仅V8高级发布）
  onUploadTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      uploadType: type,
      carouselImages: [],
      videoPath: '',
      videoCoverPath: ''
    });
  },

  // 选择轮播图
  chooseCarouselImages() {
    const maxCount = 3 - this.data.carouselImages.length;
    if (maxCount <= 0) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 验证图片格式和尺寸
        const tempFiles = res.tempFilePaths;
        const validFiles = [];
        
        tempFiles.forEach((filePath, index) => {
          // 获取图片信息
          wx.getImageInfo({
            src: filePath,
            success: (imgInfo) => {
              // 验证格式
              const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
              if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
                wx.showModal({
                  title: '格式错误',
                  content: '仅支持JPG、JPEG、PNG格式',
                  showCancel: false
                });
                return;
              }

              // 验证尺寸比例（16:9）
              const ratio = imgInfo.width / imgInfo.height;
              const targetRatio = 16 / 9;
              if (Math.abs(ratio - targetRatio) > 0.1) {
                wx.showModal({
                  title: '尺寸提示',
                  content: `建议使用16:9比例（750×422px），当前为${imgInfo.width}×${imgInfo.height}px`,
                  showCancel: false
                });
              }

              validFiles.push(filePath);
              
              // 所有文件验证完成
              if (validFiles.length === tempFiles.length) {
                this.setData({
                  carouselImages: [...this.data.carouselImages, ...validFiles]
                });
              }
            },
            fail: () => {
              wx.showToast({
                title: '图片加载失败',
                icon: 'none'
              });
            }
          });
        });
      }
    });
  },

  // 删除轮播图
  deleteCarouselImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.carouselImages];
    images.splice(index, 1);
    this.setData({
      carouselImages: images,
      carouselCoverIndex: Math.min(this.data.carouselCoverIndex, images.length - 1)
    });
  },

  // 设置轮播图封面
  setCarouselCover(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      carouselCoverIndex: index
    });
  },

  // 选择视频（V8高级发布）：最长60秒、最大50MB
  chooseVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60, // 60秒
      camera: 'back',
      success: (res) => {
        const duration = Math.floor(res.duration);
        const fileSize = res.size; // 字节

        if (duration > 60) {
          wx.showModal({
            title: '时长超限',
            content: '视频时长不能超过60秒',
            showCancel: false
          });
          return;
        }

        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileSize > maxSize) {
          wx.showModal({
            title: '文件过大',
            content: '视频文件大小不能超过50MB',
            showCancel: false
          });
          return;
        }

        // 验证格式（通过文件路径判断）
        const filePath = res.tempFilePath;
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        if (!['.mp4', '.avi'].includes(ext)) {
          wx.showModal({
            title: '格式错误',
            content: '仅支持MP4、AVI格式',
            showCancel: false
          });
          return;
        }

        // 验证分辨率（需要获取视频信息）
        // 注意：小程序chooseVideo可能无法直接获取分辨率，需要在服务端验证
        // 这里先保存，服务端再做验证

        this.setData({
          videoPath: filePath,
          videoDuration: duration,
          videoCoverPath: res.thumbTempFilePath // 使用视频缩略图作为默认封面
        });
      },
      fail: (err) => {
        console.error('选择视频失败:', err);
        wx.showToast({
          title: '选择视频失败',
          icon: 'none'
        });
      }
    });
  },

  // 修改视频封面
  modifyVideoCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          videoCoverPath: res.tempFilePaths[0]
        });
      }
    });
  },

  // 选择项目分类标签
  chooseCategory() {
    this.setData({
      showCategoryPicker: true
    });
  },

  // 关闭分类选择器
  closeCategoryPicker() {
    this.setData({
      showCategoryPicker: false
    });
  },

  // 确认选择分类
  confirmCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categoryList.find(item => item.id === categoryId);
    if (category) {
      this.setData({
        categoryTag: category.name,
        categoryTagId: category.id,
        showCategoryPicker: false
      });
    }
  },

  // 完成选择分类（点击完成按钮）
  finishCategorySelect() {
    if (!this.data.categoryTagId) {
      wx.showToast({
        title: '请选择分类',
        icon: 'none'
      });
      return;
    }
    this.setData({
      showCategoryPicker: false
    });
  },

  // 表单输入
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  onIntroductionInput(e) {
    this.setData({
      introduction: e.detail.value
    });
  },

  onStoreCountInput(e) {
    let val = e.detail.value;
    if (val !== '' && !/^\d+$/.test(val)) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 5000) {
      val = '5000';
    }
    if (!isNaN(num) && num >= 0 && num < 2) {
      val = '2';
    }
    this.setData({
      storeCount: val
    });
  },

  onIpAddressInput(e) {
    let val = e.detail.value;
    if (val.length > 6) {
      val = val.slice(0, 6);
    }
    this.setData({
      ipAddress: val
    });
  },

  onBaseAmountInput(e) {
    this.setData({
      baseAmount: e.detail.value
    });
  },

  onMaxAmountInput(e) {
    this.setData({
      maxAmount: e.detail.value
    });
  },

  // 选择详情页图片
  chooseDetailImages() {
    const maxCount = 9 - this.data.detailImages.length;
    if (maxCount <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 验证图片大小（3M以内）和宽度（750px以上）
        const tempFiles = res.tempFilePaths;
        const validFiles = [];
        let checkedCount = 0;

        const fs = wx.getFileSystemManager();
        tempFiles.forEach((filePath) => {
          // 获取文件信息
          fs.getFileInfo({
            filePath: filePath,
            success: (fileInfo) => {
              // 验证文件大小（3M = 3 * 1024 * 1024 字节）
              if (fileInfo.size > 3 * 1024 * 1024) {
                wx.showModal({
                  title: '文件过大',
                  content: '单张图片不能超过3M',
                  showCancel: false
                });
                checkedCount++;
                if (checkedCount === tempFiles.length) {
                  this.setData({
                    detailImages: [...this.data.detailImages, ...validFiles]
                  });
                }
                return;
              }

              // 获取图片信息验证宽度
              wx.getImageInfo({
                src: filePath,
                success: (imgInfo) => {
                  if (imgInfo.width < 750) {
                    wx.showModal({
                      title: '尺寸提示',
                      content: `建议宽度750px以上，当前为${imgInfo.width}px`,
                      showCancel: false
                    });
                  }
                  validFiles.push(filePath);
                  checkedCount++;
                  if (checkedCount === tempFiles.length) {
                    this.setData({
                      detailImages: [...this.data.detailImages, ...validFiles]
                    });
                  }
                },
                fail: () => {
                  validFiles.push(filePath); // 如果获取图片信息失败，也允许上传
                  checkedCount++;
                  if (checkedCount === tempFiles.length) {
                    this.setData({
                      detailImages: [...this.data.detailImages, ...validFiles]
                    });
                  }
                }
              });
            },
            fail: () => {
              checkedCount++;
              if (checkedCount === tempFiles.length) {
                this.setData({
                  detailImages: [...this.data.detailImages, ...validFiles]
                });
              }
            }
          });
        });
      }
    });
  },

  // 删除详情页图片
  deleteDetailImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.detailImages];
    images.splice(index, 1);
    this.setData({
      detailImages: images
    });
  },

  // 选择入驻协议图片
  chooseAgreementImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          agreementImage: res.tempFilePaths[0]
        });
      }
    });
  },

  // 删除入驻协议图片
  deleteAgreementImage() {
    this.setData({
      agreementImage: ''
    });
  },

  // 复制协议下载地址
  async copyAgreementLink() {
    try {
      wx.showLoading({ title: '获取中...' });
      const res = await api.getActiveAgreementTemplate();
      wx.hideLoading();
      if (res && res.fileUrl) {
        wx.setClipboardData({
          data: res.fileUrl,
          success: () => {
            wx.showToast({
              title: '已复制下载地址',
              icon: 'success'
            });
          },
          fail: () => {
            wx.showToast({
              title: '复制失败',
              icon: 'none'
            });
          }
        });
      } else {
        wx.showToast({
          title: '暂无可用协议模板',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error && error.message ? error.message : '获取协议地址失败',
        icon: 'none'
      });
    }
  },

  // 验证表单
  validateForm() {
    // 验证轮播图/视频
    if (this.data.publishType === 'flash') {
      if (this.data.carouselImages.length === 0) {
        wx.showToast({
          title: '请上传轮播图',
          icon: 'none'
        });
        return false;
      }
    } else if (this.data.publishType === 'advanced') {
      if (this.data.uploadType === 'carousel') {
        if (this.data.carouselImages.length === 0) {
          wx.showToast({
            title: '请上传轮播图',
            icon: 'none'
          });
          return false;
        }
      } else {
        if (!this.data.videoPath) {
          wx.showToast({
            title: '请上传视频',
            icon: 'none'
          });
          return false;
        }
      }
    }

    // 验证标题
    if (!this.data.title || !this.data.title.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      });
      return false;
    }

    if (this.data.title.length > 20) {
      wx.showToast({
        title: '标题不能超过20字',
        icon: 'none'
      });
      return false;
    }

    // 验证项目分类标签
    if (!this.data.categoryTag) {
      wx.showToast({
        title: '请选择项目分类标签',
        icon: 'none'
      });
      return false;
    }

    // 验证门店数
    if (!this.data.storeCount || !this.data.storeCount.trim()) {
      wx.showToast({
        title: '请输入门店数',
        icon: 'none'
      });
      return false;
    }
    const storeNum = parseInt(this.data.storeCount, 10);
    if (isNaN(storeNum) || storeNum < 2 || storeNum > 5000) {
      wx.showToast({
        title: '门店数范围为2-5000',
        icon: 'none'
      });
      return false;
    }

    // 验证IP地址
    if (!this.data.ipAddress || !this.data.ipAddress.trim()) {
      wx.showToast({
        title: '请输入IP地址（城市）',
        icon: 'none'
      });
      return false;
    }

    // 验证合作金额
    if (!this.data.baseAmount || !this.data.baseAmount.trim()) {
      wx.showToast({
        title: '请输入合作金额基本额',
        icon: 'none'
      });
      return false;
    }

    if (!this.data.maxAmount || !this.data.maxAmount.trim()) {
      wx.showToast({
        title: '请输入合作金额最大额',
        icon: 'none'
      });
      return false;
    }

    // 验证详情页图片
    if (this.data.detailImages.length === 0) {
      wx.showToast({
        title: '请上传详情页图片',
        icon: 'none'
      });
      return false;
    }

    // 验证入驻协议
    if (!this.data.agreementImage) {
      wx.showToast({
        title: '请上传入驻协议',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 提交审核
  submitReview() {
    // 先关闭可能残留的 toast/loading，避免遮挡或误以为无响应
    wx.hideToast();
    wx.hideLoading();
    if (!this.validateForm()) {
      return;
    }
    // 直接执行上传并提交（支付功能未接入前不再弹支付确认框，避免点击无响应）
    this.doSubmitReview();
  },

  // 执行提交审核（上传文件后调用 API）
  async doSubmitReview() {
    const isEdit = !!this.data.editingProjectId;
    this.setData({ uploading: true });
    wx.showLoading({ title: isEdit ? '提交修改中...' : '提交中...' });

    try {
      let carouselUrls = [];
      let videoUrl = '';
      let videoPoster = '';
      const coverType = this.data.publishType === 'advanced' && this.data.uploadType === 'video' ? 'video' : 'carousel';

      if (coverType === 'carousel') {
        for (const path of this.data.carouselImages) {
          if (typeof path === 'string' && path.indexOf('http') === 0) {
            carouselUrls.push(path);
          } else {
            const res = await api.uploadFile('/upload', path, {});
            if (res && res.url) carouselUrls.push(res.url);
          }
        }
        if (carouselUrls.length === 0) throw new Error('轮播图上传失败');
      } else {
        const isRemoteVideo = typeof this.data.videoPath === 'string' && this.data.videoPath.indexOf('http') === 0;
        if (isRemoteVideo) {
          videoUrl = this.data.videoPath;
          videoPoster = this.data.videoCoverPath || this.data.editingVideoPoster || '';
        } else {
          if (this.data.videoPath) {
            const vRes = await api.uploadFile('/upload', this.data.videoPath, {});
            if (vRes && vRes.url) videoUrl = vRes.url;
            if (!videoUrl) throw new Error('视频上传失败');
          }
          if (this.data.videoCoverPath && this.data.videoCoverPath.indexOf('http') !== 0) {
            const pRes = await api.uploadFile('/upload', this.data.videoCoverPath, {});
            if (pRes && pRes.url) videoPoster = pRes.url;
          } else if (this.data.videoCoverPath) {
            videoPoster = this.data.videoCoverPath;
          }
        }
      }

      const detailImgUrls = [];
      for (const path of this.data.detailImages) {
        const res = await api.uploadFile('/upload', path, {});
        if (res && res.url) detailImgUrls.push(res.url);
      }
      const detailContent = detailImgUrls.length
        ? detailImgUrls.map(url => `<p><img src="${url}" style="max-width:100%;" /></p>`).join('')
        : (isEdit ? (this.data.editingDetailContent || '') : '');

      const payload = {
        title: this.data.title.trim(),
        introduction: this.data.introduction.trim(),
        ipAddress: this.data.ipAddress.trim(),
        storeCount: String(this.data.storeCount),
        baseAmount: String(this.data.baseAmount),
        maxAmount: String(this.data.maxAmount),
        categoryId: this.data.categoryTagId || '',
        categoryTag: this.data.categoryTag || '',
        coverType,
        carouselImages: carouselUrls,
        videoUrl,
        videoPoster,
        detailContent,
        memberLevel: this.data.memberLevel || 'V6'
      };

      if (isEdit) {
        await api.updateProject(this.data.editingProjectId, payload);
        wx.hideLoading();
        wx.showToast({ title: '已提交修改，等待审核', icon: 'success', duration: 2000 });
        this.setData({ uploading: false, editingProjectId: '', editingDetailContent: '', editingVideoUrl: '', editingVideoPoster: '' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 2000);
        return;
      }

      // 新建项目
      const projectResult = await api.publishProject(payload);
      const projectId = projectResult && projectResult.id ? projectResult.id : null;
      if (!projectId) {
        throw new Error('项目创建失败，无法获取项目ID');
      }

      if (this.data.agreementImage) {
        try {
          await api.uploadSignedAgreement({
            filePath: this.data.agreementImage,
            projectId: projectId
          });
        } catch (agreementError) {
          console.error('上传协议图片失败:', agreementError);
          wx.showToast({
            title: '项目已提交，但协议上传失败，请稍后重新上传',
            icon: 'none',
            duration: 3000
          });
        }
      }

      wx.hideLoading();
      wx.showToast({ title: '已成功提交', icon: 'success', duration: 2000 });
      this.setData({ uploading: false });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 2000);
    } catch (error) {
      wx.hideLoading();
      this.setData({ uploading: false });
      wx.showToast({ title: error && error.message ? error.message : '提交失败', icon: 'none' });
    }
  },

  // 格式化视频时长
  formatVideoDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
});
