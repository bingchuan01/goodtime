let timer = null;

Page({
  data: {
    src: '/images/splash.jpg',
    safeTop: 0,
    windowHeight: 667
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const safeTop = sys.safeArea ? sys.safeArea.top : (sys.statusBarHeight + 32);
    this.setData({
      safeTop,
      windowHeight: sys.windowHeight
    });
  },

  onShow() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      this.goHome();
    }, 1500);
  },

  onHide() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  },

  onUnload() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  },

  goHome() {
    if (this._navigated) return;
    this._navigated = true;
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onImageError() {
    // 避免资源缺失导致白屏：回退到仓库内已有的 logo
    if (this.data.src !== '/images/logo.svg') {
      this.setData({ src: '/images/logo.svg' });
    }
  }
});

