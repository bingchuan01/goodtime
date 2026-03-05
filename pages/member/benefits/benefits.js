// 会员权益页（会员中心）
const auth = require('../../../utils/auth');
const api = require('../../../utils/api');

// 16 项权益，红色翅膀=可享。V6 默认开通：矩阵全域推、SEO引流
const BENEFITS_LIST = [
  { id: 1, name: '积分加速', icon: '翼', enabled: false },
  { id: 2, name: '赠送S币', icon: '翼', enabled: false },
  { id: 3, name: '金盾认证', icon: '翼', enabled: false },
  { id: 4, name: 'API接口', icon: '翼', enabled: false },
  { id: 5, name: '私域搭建', icon: '翼', enabled: false },
  { id: 6, name: '用户培训支持', icon: '翼', enabled: false },
  { id: 7, name: '品牌全案设计', icon: '翼', enabled: false },
  { id: 8, name: '品牌代运营', icon: '翼', enabled: false },
  { id: 9, name: '专栏置顶', icon: '翼', enabled: false },
  { id: 10, name: '直播助力', icon: '翼', enabled: false },
  { id: 11, name: 'VCR视频宣发', icon: '翼', enabled: false },
  { id: 12, name: '矩阵全域推', icon: '翼', enabled: true },
  { id: 13, name: '算法引流', icon: '翼', enabled: false },
  { id: 14, name: 'SEO引流', icon: '翼', enabled: true },
  { id: 15, name: '沙龙专场会', icon: '翼', enabled: false },
  { id: 16, name: '更多权益', icon: '翼', enabled: false }
];

// 层叠轮播 8 张
const CAROUSEL_COLORS = [
  'linear-gradient(135deg, rgba(230, 180, 220, 0.5) 0%, rgba(180, 160, 220, 0.5) 100%)',
  'linear-gradient(135deg, rgba(255, 182, 193, 0.5) 0%, rgba(221, 160, 221, 0.5) 100%)',
  'linear-gradient(135deg, rgba(176, 224, 230, 0.5) 0%, rgba(230, 230, 250, 0.5) 100%)',
  'linear-gradient(135deg, rgba(255, 218, 185, 0.5) 0%, rgba(255, 228, 196, 0.5) 100%)',
  'linear-gradient(135deg, rgba(240, 248, 255, 0.6) 0%, rgba(230, 230, 250, 0.6) 100%)',
  'linear-gradient(135deg, rgba(255, 240, 245, 0.6) 0%, rgba(238, 224, 229, 0.6) 100%)',
  'linear-gradient(135deg, rgba(245, 245, 220, 0.5) 0%, rgba(255, 228, 225, 0.5) 100%)',
  'linear-gradient(135deg, rgba(230, 230, 250, 0.5) 0%, rgba(216, 191, 216, 0.5) 100%)'
];

Page({
  data: {
    userInfo: {}, // 初始为空对象，避免首帧访问 userInfo.xxx 报错导致页面不渲染
    isMember: false,
    memberExpireText: '', // 会员有效期展示文案，如 2025-12-31 或 永久
    benefitsList: BENEFITS_LIST,
    carouselList: [],
    carouselIndex: 0,
    carouselScrollLeft: 0,
    carouselBg: CAROUSEL_COLORS[0],
    showFooterBar: false
  },

  onLoad() {
    this._syncUserAndMember();
    this._loadCarouselData();
  },

  onShow() {
    this._syncUserAndMember();
  },

  // 同步用户信息与会员有效期展示（V6/V8 字符串或数字等级均视为已开通）
  _syncUserAndMember() {
    const userInfo = auth.getUserInfo() || {};
    const level = userInfo.member_level || userInfo.memberLevel || 0;
    const isMember = level === 'V6' || level === 'V8' || (typeof level === 'number' && level > 0);
    let memberExpireText = '';
    let expireTime = null;
    if (isMember && userInfo.member_expire_time) {
      const t = new Date(userInfo.member_expire_time);
      if (!isNaN(t.getTime())) {
        memberExpireText = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        expireTime = t;
      } else {
        memberExpireText = '永久';
      }
    } else if (isMember) {
      memberExpireText = '永久';
    }
    this.setData({
      userInfo,
      isMember,
      memberExpireText
    });
    // 会员有效期结束预警：剩余 30 天内弹窗提示（每次进入本页至多提示一次）
    if (isMember && expireTime && !this._expireWarningShown) {
      const now = new Date();
      const msLeft = expireTime.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      if (daysLeft <= 0) {
        this._expireWarningShown = true;
        wx.showModal({
          title: '会员已到期',
          content: '您的会员已到期，续费后可继续享受权益。',
          confirmText: '去续费',
          cancelText: '知道了',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/member/upgrade/upgrade' });
            }
          }
        });
      } else if (daysLeft <= 30) {
        this._expireWarningShown = true;
        wx.showModal({
          title: '会员即将到期',
          content: `您的会员将于 ${daysLeft} 天后到期（${memberExpireText}），请及时续费以免影响使用。`,
          confirmText: '去续费',
          cancelText: '知道了',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/member/upgrade/upgrade' });
            }
          }
        });
      }
    }
  },

  // 跳转支付页（会员升级/支付方式页）
  goUpgrade() {
    wx.navigateTo({
      url: '/pages/member/upgrade/upgrade'
    });
  },

  onScroll(e) {
    const scrollTop = e.detail.scrollTop || 0;
    // 接近底部时显示吸底按钮（阈值约 400rpx）
    const show = scrollTop > 200;
    if (this.data.showFooterBar !== show) {
      this.setData({ showFooterBar: show });
    }
  },

  onScrollToLower() {
    this.setData({ showFooterBar: true });
  },

  // 加载轮播图数据
  async _loadCarouselData() {
    try {
      const data = await api.getConfig('benefits_carousel');
      let carouselList = [];
      if (Array.isArray(data) && data.length > 0) {
        carouselList = data.map((item, index) => ({
          id: item.id || index + 1,
          title: item.title || `案例 ${index + 1}`,
          cover: item.cover || '',
          link: item.link || '',
          linkType: item.linkType || 'external' // external: 外部链接, internal: 内部页面
        }));
      } else {
        // 如果没有数据，使用默认的8个占位
        carouselList = Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          title: `案例 ${i + 1}`,
          cover: '',
          link: '',
          linkType: 'external'
        }));
      }
      this.setData({
        carouselList,
        carouselBg: carouselList.length > 0 ? CAROUSEL_COLORS[0] : CAROUSEL_COLORS[0]
      });
    } catch (error) {
      console.error('加载轮播图数据失败:', error);
      // 使用默认数据
      const defaultList = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        title: `案例 ${i + 1}`,
        cover: '',
        link: '',
        linkType: 'external'
      }));
      this.setData({ carouselList: defaultList });
    }
  },

  onCarouselScroll(e) {
    const scrollLeft = e.detail.scrollLeft || 0;
    const itemWidth = 280 + 24; // 卡片宽 + margin
    const index = Math.round(scrollLeft / itemWidth);
    const safeIndex = Math.max(0, Math.min(index, this.data.carouselList.length - 1));
    if (this.data.carouselIndex !== safeIndex) {
      this.setData({
        carouselIndex: safeIndex,
        carouselBg: CAROUSEL_COLORS[safeIndex % CAROUSEL_COLORS.length]
      });
    }
  },

  onCarouselTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.carouselList[index];
    if (!item || !item.link) {
      return;
    }

    // 判断链接类型
    if (item.linkType === 'internal') {
      // 内部页面跳转
      wx.navigateTo({ url: item.link });
    } else {
      // 外部链接：抖音、小红书、视频号、公众号等
      // 小程序中打开外部链接需要使用 web-view 组件或复制链接
      wx.showModal({
        title: '打开外部链接',
        content: '是否复制链接到剪贴板？',
        confirmText: '复制',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: item.link,
              success: () => {
                wx.showToast({
                  title: '链接已复制',
                  icon: 'success'
                });
              }
            });
          }
        }
      });
    }
  },

  onCarouselDotTap(e) {
    const index = e.currentTarget.dataset.index;
    const itemWidth = 280 + 24;
    const scrollLeft = index * itemWidth;
    this.setData({
      carouselIndex: index,
      carouselScrollLeft: scrollLeft,
      carouselBg: CAROUSEL_COLORS[index % CAROUSEL_COLORS.length]
    });
  }
});
