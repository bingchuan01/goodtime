// 权限管理工具

/**
 * 会员等级定义
 */
const MEMBER_LEVELS = {
  NORMAL: 0,  // 普通用户
  VIP: 1,     // VIP
  SVIP: 2     // SVIP
};

/**
 * 权限配置
 * 定义每个操作所需的会员等级
 */
const PERMISSIONS = {
  // 视频相关
  'publish_video': MEMBER_LEVELS.NORMAL,      // 发布视频（普通用户即可）
  'publish_unlimited': MEMBER_LEVELS.SVIP,    // 无限制发布
  'view_hd_video': MEMBER_LEVELS.VIP,         // 观看高清视频
  'view_member_video': MEMBER_LEVELS.VIP,     // 观看会员专享视频
  'video_duration_60': MEMBER_LEVELS.NORMAL,  // 60秒视频
  'video_duration_300': MEMBER_LEVELS.VIP,    // 300秒视频
  'video_duration_unlimited': MEMBER_LEVELS.SVIP, // 无限制时长
  
  // 发布数量限制
  'publish_count_3': MEMBER_LEVELS.NORMAL,    // 每日3个
  'publish_count_10': MEMBER_LEVELS.VIP,      // 每日10个
  'publish_count_unlimited': MEMBER_LEVELS.SVIP, // 无限制
};

/**
 * 获取用户会员等级
 */
function getUserMemberLevel() {
  const userInfo = wx.getStorageSync('userInfo');
  if (!userInfo) return MEMBER_LEVELS.NORMAL;
  
  // 检查会员是否过期
  if (userInfo.member_expire_time) {
    const expireTime = new Date(userInfo.member_expire_time);
    if (expireTime < new Date()) {
      return MEMBER_LEVELS.NORMAL;
    }
  }
  
  return userInfo.member_level || MEMBER_LEVELS.NORMAL;
}

/**
 * 检查权限
 * @param {string} action 操作名称
 * @param {number} userLevel 用户会员等级（可选，不传则自动获取）
 * @returns {boolean} 是否有权限
 */
function checkPermission(action, userLevel = null) {
  if (userLevel === null) {
    userLevel = getUserMemberLevel();
  }
  
  const requiredLevel = PERMISSIONS[action];
  if (requiredLevel === undefined) {
    console.warn(`权限配置中未找到: ${action}`);
    return false;
  }
  
  return userLevel >= requiredLevel;
}

/**
 * 检查多个权限（需要同时满足）
 */
function checkPermissions(actions, userLevel = null) {
  if (userLevel === null) {
    userLevel = getUserMemberLevel();
  }
  
  return actions.every(action => checkPermission(action, userLevel));
}

/**
 * 检查权限并提示
 * @param {string} action 操作名称
 * @param {string} message 提示信息（可选）
 * @returns {boolean} 是否有权限
 */
function checkPermissionWithTip(action, message = null) {
  const hasPermission = checkPermission(action);
  
  if (!hasPermission) {
    const userLevel = getUserMemberLevel();
    const requiredLevel = PERMISSIONS[action];
    
    let tipMessage = message;
    if (!tipMessage) {
      if (requiredLevel === MEMBER_LEVELS.VIP) {
        tipMessage = '此功能需要VIP会员，是否前往升级？';
      } else if (requiredLevel === MEMBER_LEVELS.SVIP) {
        tipMessage = '此功能需要SVIP会员，是否前往升级？';
      } else {
        tipMessage = '权限不足';
      }
    }
    
    wx.showModal({
      title: '权限提示',
      content: tipMessage,
      confirmText: '去升级',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/member/upgrade/upgrade'
          });
        }
      }
    });
  }
  
  return hasPermission;
}

/**
 * 获取会员等级名称
 */
function getMemberLevelName(level) {
  const names = {
    [MEMBER_LEVELS.NORMAL]: '普通用户',
    [MEMBER_LEVELS.VIP]: 'VIP',
    [MEMBER_LEVELS.SVIP]: 'SVIP'
  };
  return names[level] || '普通用户';
}

/**
 * 获取会员等级颜色
 */
function getMemberLevelColor(level) {
  const colors = {
    [MEMBER_LEVELS.NORMAL]: '#999999',
    [MEMBER_LEVELS.VIP]: '#FFD700',
    [MEMBER_LEVELS.SVIP]: '#FF6B9D'
  };
  return colors[level] || '#999999';
}

/**
 * 获取用户每日可发布视频数量
 */
function getDailyPublishLimit(userLevel = null) {
  if (userLevel === null) {
    userLevel = getUserMemberLevel();
  }
  
  if (checkPermission('publish_count_unlimited', userLevel)) {
    return Infinity;
  } else if (checkPermission('publish_count_10', userLevel)) {
    return 10;
  } else {
    return 3;
  }
}

/**
 * 获取用户可发布视频最大时长（秒）
 */
function getMaxVideoDuration(userLevel = null) {
  if (userLevel === null) {
    userLevel = getUserMemberLevel();
  }
  
  if (checkPermission('video_duration_unlimited', userLevel)) {
    return Infinity;
  } else if (checkPermission('video_duration_300', userLevel)) {
    return 300;
  } else {
    return 60;
  }
}

module.exports = {
  MEMBER_LEVELS,
  PERMISSIONS,
  getUserMemberLevel,
  checkPermission,
  checkPermissions,
  checkPermissionWithTip,
  getMemberLevelName,
  getMemberLevelColor,
  getDailyPublishLimit,
  getMaxVideoDuration
};






