// 用户认证工具

const api = require('./api');

/**
 * 标记：首页可见时播放看板展开→收起动画
 * @param {{ persist?: boolean }} opts persist 为 true 时写入 storage（账号登录回首页兜底）
 */
function markHomeDashboardIntro(opts) {
  const persist = opts && opts.persist;
  if (persist) {
    try {
      wx.setStorageSync('homeDashboardIntro', 1);
    } catch (e) {
      /* ignore */
    }
  }
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.homeDashboardIntroPending = true;
      app.globalData.homeDashboardIntroKind = 'login';
    }
  } catch (e) {
    /* ignore */
  }
}

/** 冷启动：引导页即将进入首页（仅内存标记，避免引导期间 Tab 预加载消费） */
function markLaunchDashboardIntro() {
  try {
    const app = getApp();
    if (!app || !app.globalData) return;
    if (app.globalData.homeDashboardLaunchIntroPlayed) return;
    app.globalData.homeDashboardIntroPending = true;
    app.globalData.homeDashboardIntroKind = 'launch';
  } catch (e) {
    /* ignore */
  }
}

/** 引导页结束 → 首页，并在首页真正显示后再播看板动画 */
function goIndexFromGuide() {
  markLaunchDashboardIntro();
  wx.switchTab({
    url: '/pages/index/index',
    success: () => {
      setTimeout(() => notifyIndexDashboardIntro(), 120);
      setTimeout(() => notifyIndexDashboardIntro(), 350);
    },
    fail: () => {
      setTimeout(() => notifyIndexDashboardIntro(), 400);
    }
  });
}

/** 登录成功后跳转首页并主动触发看板动画（不依赖 onShow 时序） */
function goHomeAfterLogin(delayMs) {
  markHomeDashboardIntro({ persist: true });
  const delay = typeof delayMs === 'number' ? delayMs : 200;
  const navigate = () => {
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        notifyIndexDashboardIntro();
        setTimeout(() => notifyIndexDashboardIntro(), 150);
        setTimeout(() => notifyIndexDashboardIntro(), 400);
      },
      fail: () => {
        setTimeout(() => notifyIndexDashboardIntro(), 300);
      }
    });
  };
  if (delay > 0) {
    setTimeout(navigate, delay);
  } else {
    navigate();
  }
}

function notifyIndexDashboardIntro() {
  try {
    const app = getApp();
    if (app && typeof app._notifyHomeDashboardIntro === 'function') {
      if (app._notifyHomeDashboardIntro()) return true;
    }
  } catch (e) {
    /* ignore */
  }
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    if (page && page.route === 'pages/index/index' && typeof page.triggerDashboardIntro === 'function') {
      page.triggerDashboardIntro();
      return true;
    }
  }
  return false;
}

/**
 * 微信登录
 */
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        if (res.code) {
          try {
            // 调用后端登录接口
            const result = await api.wxLogin(res.code);
            
            // 保存token和用户信息
            if (result.token) {
              wx.setStorageSync('token', result.token);
              markHomeDashboardIntro({ persist: true });
            }
            if (result.userInfo) {
              wx.setStorageSync('userInfo', result.userInfo);
            }
            if (result.isNew) {
              api.clearShareRef();
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error('获取code失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 检查登录状态
 */
function checkLogin() {
  const token = wx.getStorageSync('token');
  const userInfo = wx.getStorageSync('userInfo');
  
  return !!(token && userInfo);
}

/**
 * 获取用户信息（从缓存）
 */
function getUserInfo() {
  return wx.getStorageSync('userInfo') || null;
}

/** 并发去重：短时间内多次 refresh 只发一次 /user/info */
let refreshUserInfoPromise = null;

/**
 * 更新用户信息（从服务器）
 */
async function refreshUserInfo() {
  const token = wx.getStorageSync('token') || '';
  if (!token) {
    return wx.getStorageSync('userInfo') || null;
  }
  if (refreshUserInfoPromise) {
    return refreshUserInfoPromise;
  }
  refreshUserInfoPromise = api
    .getUserInfo()
    .then((userInfo) => {
      if (userInfo) {
        const prev = wx.getStorageSync('userInfo') || {};
        wx.setStorageSync('userInfo', { ...prev, ...userInfo });
        try {
          require('./location').applyFromUserInfo(userInfo);
        } catch (e) {
          /* ignore */
        }
      }
      return userInfo;
    })
    .catch((error) => {
      const msg = (error && error.errMsg) || '';
      if (msg.indexOf('domain') === -1 && msg.indexOf('request:fail') === -1) {
        console.warn('刷新用户信息失败:', error);
      }
      return null;
    })
    .finally(() => {
      refreshUserInfoPromise = null;
    });
  return refreshUserInfoPromise;
}

/**
 * 退出登录
 */
function logout() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.reLaunch({
    url: '/pages/login/login'
  });
}

/**
 * 需要登录的页面跳转前检查
 */
function requireLogin(callback) {
  if (checkLogin()) {
    callback && callback();
  } else {
    wx.showModal({
      title: '提示',
      content: '请先登录',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
}

module.exports = {
  markHomeDashboardIntro,
  markLaunchDashboardIntro,
  goIndexFromGuide,
  goHomeAfterLogin,
  notifyIndexDashboardIntro,
  wxLogin,
  checkLogin,
  getUserInfo,
  refreshUserInfo,
  logout,
  requireLogin
};






