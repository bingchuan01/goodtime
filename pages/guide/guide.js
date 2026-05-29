const auth = require('../../utils/auth');

let timer = null;

Page({
  data: {
    src: '/images/splash.png',
    safeTop: 0,
    imageHeight: 667,
    screenHeight: 844
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const sh = sys.screenHeight != null ? sys.screenHeight : sys.windowHeight;
    this.setData({
      screenHeight: sh,
      imageHeight: sh
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
    auth.goIndexFromGuide();
  },

  onImageError() {
    // 避免资源缺失导致白屏：回退到仓库内已有的 logo
    if (this.data.src !== '/images/logo.svg') {
      this.setData({ src: '/images/logo.svg' });
    }
  }
});

