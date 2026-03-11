// API 服务封装
// ---------------------------------------------------------------------------
// BASE_URL 推荐配置（按环境只保留一种，其余注释掉或改 ENV 即可）
// ---------------------------------------------------------------------------
// 方式一：按环境切换（推荐）- 改 ENV 即可，无需改具体地址
var ENV = 'prod'; // 'local' | 'device' | 'prod'
var BASE_URL_MAP = {
  local: 'http://localhost:3000/api',           // 开发者工具模拟器，请求本机
  device: 'http://192.168.1.60:3000/api',       // 真机调试：改为你电脑的局域网 IP（与手机同 WiFi）
  prod: 'https://api.goodtime.work/api'         // 正式环境：线上 API 域名
};
var BASE_URL = BASE_URL_MAP[ENV] || BASE_URL_MAP.local;

// 方式二：直接写死（不推荐，每次换环境都要改）
// const BASE_URL = 'http://192.168.1.60:3000/api';
// ---------------------------------------------------------------------------
// 真机调试时如何查电脑局域网 IP：Windows 命令行执行 ipconfig，看「无线局域网」的 IPv4；Mac/Linux 执行 ifconfig 或 ip addr
// ---------------------------------------------------------------------------

/**
 * 请求封装
 * @param {string} url
 * @param {string} method
 * @param {object} data
 * @param {object} extraHeader - 可选，追加到默认 header（如 X-User-Id）
 * @param {boolean} silent - 为 true 时请求失败不弹「网络连接失败」等 toast（由页面自行展示空状态/重试）
 */
function request(url, method = 'GET', data = {}, extraHeader = {}, silent = false) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') || '';
    const userInfo = wx.getStorageSync('userInfo') || null;
    const header = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...extraHeader
    };
    if (userInfo && userInfo.id) header['X-User-Id'] = String(userInfo.id);

    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header,
      success: (res) => {
        // 200 与 201（创建成功）均视为成功
        if (res.statusCode === 200 || res.statusCode === 201) {
          if (res.data.code === 0 || res.data.success) {
            resolve(res.data.data || res.data);
          } else {
            if (!silent) {
              wx.showToast({
                title: res.data.message || '请求失败',
                icon: 'none'
              });
            }
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.reLaunch({
            url: '/pages/login/login'
          });
          reject(res);
        } else {
          if (!silent) {
            wx.showToast({
              title: '网络错误',
              icon: 'none'
            });
          }
          reject(res);
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        const isDomainError = msg.indexOf('domain') !== -1 || msg.indexOf('url not in') !== -1;
        if (!silent && !isDomainError) {
          wx.showToast({
            title: '网络连接失败',
            icon: 'none'
          });
        }
        reject(err);
      }
    });
  });
}

/**
 * GET请求
 * @param {boolean} silent - 为 true 时不弹「网络连接失败」等 toast（如首页项目列表，由页面展示空状态+重试）
 */
function get(url, data = {}, extraHeader = {}, silent = false) {
  return request(url, 'GET', data, extraHeader, silent);
}

/**
 * POST请求
 */
function post(url, data = {}) {
  return request(url, 'POST', data);
}

/**
 * PUT请求
 */
function put(url, data = {}) {
  return request(url, 'PUT', data);
}

/**
 * DELETE请求
 */
function del(url, data = {}) {
  return request(url, 'DELETE', data);
}

/**
 * 文件上传（走当前 API 域名）
 */
function uploadFile(url, filePath, formData = {}, onProgress = null) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') || '';
    const userInfo = wx.getStorageSync('userInfo') || null;
    if (!token) {
      const err = new Error('未登录，无法上传');
      reject(err);
      return;
    }
    const header = {
      'Authorization': token ? `Bearer ${token}` : ''
    };
    if (userInfo && userInfo.id) header['X-User-Id'] = String(userInfo.id);

    wx.uploadFile({
      url: BASE_URL + url,
      filePath: filePath,
      name: 'file',
      formData: formData,
      header,
      success: (res) => {
        try {
          if (res.statusCode === 401) {
            const err = new Error('登录已过期');
            err.statusCode = 401;
            reject(err);
            return;
          }
          const data = JSON.parse(res.data);
          if (data.code === 0 || data.success) {
            resolve(data.data || data);
          } else {
            const err = new Error(data.message || '上传失败');
            err.data = data;
            reject(err);
          }
        } catch (e) {
          const err = new Error('服务器响应格式错误');
          err.originalError = e;
          reject(err);
        }
      },
      fail: (err) => {
        const errMsg = (err && err.errMsg) || '';
        let msg = '上传失败';
        if (errMsg.indexOf('domain') !== -1 || errMsg.indexOf('url not in') !== -1) {
          msg = '域名未配置，请检查合法域名设置';
        } else if (errMsg.indexOf('request:fail') !== -1) {
          msg = '网络连接失败，请检查服务器地址和网络';
        } else if (errMsg.indexOf('timeout') !== -1) {
          msg = '上传超时，请重试';
        }
        const error = new Error(msg);
        error.errMsg = errMsg;
        error.originalError = err;
        reject(error);
      }
    });
  });
}

/**
 * 获取 OSS 直传凭证（后端未配置 OSS 时返回 501，不弹 toast）
 */
function getOssUploadPolicy(ext) {
  return get('/upload/oss-policy', { ext: ext || '.jpg' }, {}, true)
    .then(function (data) {
      return data && data.host ? data : null;
    })
    .catch(function (err) {
      if (err && (err.code === 501 || err.statusCode === 501)) return Promise.resolve(null);
      return Promise.reject(err);
    });
}

/**
 * 直传文件到 OSS（PostObject）。需先把 OSS 桶域名加入小程序 uploadFile 合法域名。
 */
function uploadFileToOss(filePath, policyData) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: policyData.host,
      filePath: filePath,
      name: 'file',
      formData: {
        key: policyData.key,
        policy: policyData.policy,
        OSSAccessKeyId: policyData.OSSAccessKeyId,
        signature: policyData.signature,
        success_action_status: '200'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve({ url: policyData.url });
        } else {
          reject(new Error(res.statusCode === 413 ? '文件过大' : ('上传失败 ' + res.statusCode)));
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '上传失败';
        if (msg.indexOf('domain') !== -1 || msg.indexOf('url not in') !== -1) {
          reject(new Error('请将 OSS 桶域名加入小程序 uploadFile 合法域名'));
        } else {
          reject(new Error(msg));
        }
      }
    });
  });
}

/**
 * 优先 OSS 直传，不可用时回退到接口上传（避免 413）
 * @param {string} filePath - 本地路径
 * @param {string} [ext] - 扩展名，如 '.jpg' / '.mp4'，默认 '.jpg'
 * @returns {Promise<{url: string}>}
 */
function uploadFileOrOss(filePath, ext) {
  ext = ext || '.jpg';
  return getOssUploadPolicy(ext).then(function (policyData) {
    if (policyData) return uploadFileToOss(filePath, policyData);
    return uploadFile('/upload', filePath, {});
  });
}

// ============ 用户相关API ============

/**
 * 微信登录
 */
function wxLogin(code) {
  return post('/user/login', { code });
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return get('/user/info');
}

/**
 * 更新用户信息
 */
function updateUserInfo(data) {
  return put('/user/info', data);
}

/**
 * 获取用户发布的项目列表（我的发布）
 * @param {string} userId
 * @param {number} page
 * @param {number} pageSize
 * @param {string} [status] '' | 'approved' | 'rejected' | 'pending'
 */
function getUserVideos(userId, page = 1, pageSize = 10, status = '') {
  const params = { userId, page, pageSize };
  if (status) params.status = status;
  return get('/user/videos', params);
}

// ============ 视频相关API ============

/**
 * 获取视频列表
 */
function getVideoList(params = {}) {
  const { page = 1, pageSize = 10, category, keyword } = params;
  return get('/videos', { page, pageSize, category, keyword });
}

/**
 * 获取视频详情
 */
function getVideoDetail(videoId) {
  return get(`/videos/${videoId}`);
}

/**
 * 发布视频
 */
function publishVideo(data) {
  return post('/videos', data);
}

/**
 * 更新视频
 */
function updateVideo(videoId, data) {
  return put(`/videos/${videoId}`, data);
}

/**
 * 删除视频
 */
function deleteVideo(videoId) {
  return del(`/videos/${videoId}`);
}

/**
 * 点赞视频
 */
function likeVideo(videoId) {
  return post(`/videos/${videoId}/like`);
}

/**
 * 获取视频评论
 */
function getVideoComments(videoId, page = 1, pageSize = 20) {
  return get(`/videos/${videoId}/comments`, { page, pageSize });
}

/**
 * 发表评论
 */
function addComment(videoId, content) {
  return post(`/videos/${videoId}/comments`, { content });
}

/**
 * 获取项目列表（首页瀑布流）
 * @param {object} params - { page, pageSize, categoryId, displayZone }
 */
function getProjectList(params = {}) {
  const { page = 1, pageSize = 10, categoryId, displayZone } = params;
  return get('/projects', { page, pageSize, categoryId, displayZone }, {}, true);
}

/**
 * 获取项目详情
 */
function getProjectDetail(id) {
  return get(`/projects/${id}`);
}

/**
 * 发布项目（提交审核）
 */
function publishProject(data) {
  return post('/projects', data);
}

/**
 * 更新项目（仅退回后可编辑）
 */
function updateProject(id, data) {
  return put(`/projects/${id}`, data);
}

/**
 * 获取配置（购买须知、权益说明、数据看板等）
 * @param {string} key - purchase_notice | benefits_doc | dashboard | benefits_carousel
 */
function getConfig(key) {
  return get(`/config/${key}`);
}

// ============ 分类相关API ============

/**
 * 获取项目分类列表（官方后台可添加/删除）
 * @returns {Promise<Array<{ id, name, icon }>>}
 */
function getCategories() {
  return get('/categories');
}

// ============ 搜索相关API ============

/**
 * 搜索项目（标题、品牌、行业模糊匹配，支持联想与容错由前端或后端实现）
 * @param {object} params - { keyword, categoryIds?, page, pageSize }
 */
function searchProjects(params = {}) {
  const { keyword, categoryIds, page = 1, pageSize = 20 } = params;
  return get('/search/projects', { keyword, categoryIds: categoryIds && categoryIds.join(','), page, pageSize });
}

// ============ 会员相关API ============

/**
 * 获取会员信息
 */
function getMemberInfo() {
  return get('/member/info');
}

/**
 * 获取会员等级列表
 */
function getMemberLevels() {
  return get('/member/levels');
}

/**
 * 创建会员订单（V6，返回支付参数）
 */
function createMemberOrder(plan) {
  return post('/member/order', { plan });
}

/**
 * 获取会员权益
 */
function getMemberBenefits() {
  return get('/member/benefits');
}

// ============ 权限相关API ============

/**
 * 检查权限
 */
function checkPermission(action) {
  return get('/permission/check', { action });
}

// ============ 站内信相关 API ============

/**
 * 获取站内信列表（收件箱，分页）
 * @param {object} params - { page, pageSize, type: 'inbox' }
 * @returns {Promise<{ list, hasMore }>}
 */
function getMessageList(params = {}) {
  const { page = 1, pageSize = 10, type = 'inbox' } = params;
  return get('/messages', { page, pageSize, type });
}

/**
 * 获取站内信详情
 * @param {string|number} id - 消息 id
 */
function getMessageDetail(id) {
  return get(`/messages/${id}`);
}

/**
 * 发送站内信
 * @param {object} data - { recipientId, subject, body, contact? }（咨询合作发官方时 contact 必填）
 */
function sendMessage(data) {
  return post('/messages', data);
}

/**
 * 标记站内信已读
 * @param {string|number} id - 消息 id
 */
function markMessageRead(id) {
  return post(`/messages/${id}/read`, {});
}

/**
 * 删除站内信（软删）
 * @param {string|number} id - 消息 id
 */
function deleteMessage(id) {
  return del(`/messages/${id}`);
}

/**
 * 提交线索（免费获取品牌资料）
 */
function submitLead(projectId, data) {
  return post('/leads', { projectId, ...data });
}

// ============ 入驻协议相关API ============

/**
 * 获取当前激活的协议模板（用于下载）
 */
function getActiveAgreementTemplate() {
  return get('/settlement-agreement/template/active');
}

/**
 * 上传已签字盖章的协议
 * @param {object} data - { projectId?, agreementTemplateId?, filePath }
 */
function uploadSignedAgreement(data) {
  const { filePath, projectId, agreementTemplateId } = data;
  if (!filePath) {
    return Promise.reject(new Error('请选择协议文件'));
  }
  return uploadFile('/settlement-agreement/upload-signed', filePath, {
    projectId: projectId || '',
    agreementTemplateId: agreementTemplateId || ''
  });
}

module.exports = {
  // 基础方法
  request,
  get,
  post,
  put,
  del,
  uploadFile,
  uploadFileOrOss,
  getOssUploadPolicy,
  uploadFileToOss,

  // 用户相关
  wxLogin,
  getUserInfo,
  updateUserInfo,
  getUserVideos,
  
  // 项目相关
  getProjectList,
  getProjectDetail,
  publishProject,
  updateProject,
  getConfig,

  // 分类相关
  getCategories,

  // 搜索相关
  searchProjects,

  // 视频相关
  getVideoList,
  getVideoDetail,
  publishVideo,
  updateVideo,
  deleteVideo,
  likeVideo,
  getVideoComments,
  addComment,
  
  // 会员相关
  getMemberInfo,
  getMemberLevels,
  createMemberOrder,
  getMemberBenefits,
  
  // 权限相关
  checkPermission,

  // 站内信相关
  getMessageList,
  getMessageDetail,
  sendMessage,
  markMessageRead,
  deleteMessage,
  submitLead,

  // 入驻协议相关
  getActiveAgreementTemplate,
  uploadSignedAgreement
};






