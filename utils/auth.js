// 用户认证工具

const api = require('./api');

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
            }
            if (result.userInfo) {
              wx.setStorageSync('userInfo', result.userInfo);
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

/**
 * 更新用户信息（从服务器）
 */
async function refreshUserInfo() {
  try {
    const userInfo = await api.getUserInfo();
    wx.setStorageSync('userInfo', userInfo);
    return userInfo;
  } catch (error) {
    // 开发期常见：url not in domain list / 未配置后端，静默失败并使用缓存
    const msg = (error && error.errMsg) || '';
    if (msg.indexOf('domain') === -1 && msg.indexOf('request:fail') === -1) {
      console.warn('刷新用户信息失败:', error);
    }
    return null;
  }
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
  wxLogin,
  checkLogin,
  getUserInfo,
  refreshUserInfo,
  logout,
  requireLogin
};






