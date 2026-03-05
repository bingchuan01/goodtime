# 短视频小程序开发指南

## 项目概述

这是一个完整的短视频小程序项目，包含以下核心功能：
- ✅ 短视频发布与上传
- ✅ 短视频详情页展示
- ✅ 用户管理系统
- ✅ 会员等级权限体系

## 项目结构

```
goodtime/
├── app.js                 # 小程序入口
├── app.json              # 全局配置
├── app.wxss              # 全局样式
├── pages/                # 页面目录
│   ├── index/           # 首页（视频列表）
│   ├── video-detail/    # 视频详情页
│   ├── publish/         # 视频发布页
│   ├── login/           # 登录页
│   ├── user/            # 用户相关页面
│   │   ├── profile/     # 个人中心
│   │   ├── videos/      # 我的视频
│   │   └── settings/    # 设置
│   └── member/          # 会员相关页面
│       ├── center/      # 会员中心
│       ├── benefits/    # 会员权益
│       └── upgrade/     # 会员升级
├── components/          # 组件目录
│   ├── navigation-bar/  # 导航栏组件
│   ├── video-card/      # 视频卡片组件
│   └── member-badge/    # 会员徽章组件
└── utils/               # 工具函数
    ├── api.js          # API服务封装
    ├── auth.js         # 认证工具
    ├── permission.js   # 权限管理
    └── util.js         # 通用工具
```

## 快速开始

### 1. 配置后端API地址

编辑 `utils/api.js`，修改 `BASE_URL` 为你的后端API地址：

```javascript
const BASE_URL = 'https://your-api-domain.com/api';
```

### 2. 配置小程序AppID

在微信开发者工具中：
1. 打开项目
2. 在项目设置中配置你的小程序AppID

### 3. 后端开发

根据 `技术方案.md` 中的API设计文档，开发对应的后端接口。

### 4. 云存储配置

视频文件需要上传到云存储（推荐腾讯云COS）：
1. 在 `pages/publish/publish.js` 中配置上传逻辑
2. 后端需要提供获取上传凭证的接口

## 核心功能说明

### 1. 用户认证

- 使用微信登录（`wx.login`）
- Token存储在本地缓存
- 自动刷新用户信息

### 2. 权限管理

会员等级体系：
- **普通用户 (level 0)**: 基础功能
- **VIP (level 1)**: 更多发布数量、高清视频
- **SVIP (level 2)**: 无限制发布、所有权益

权限检查：
```javascript
const permission = require('../../utils/permission');

// 检查权限
if (permission.checkPermission('publish_video')) {
  // 有权限
}

// 检查权限并提示
permission.checkPermissionWithTip('view_member_video');
```

### 3. 视频上传流程

1. 用户选择视频
2. 前端验证（时长、大小等）
3. 获取上传凭证（从后端）
4. 上传到云存储（COS/OSS）
5. 保存视频信息到数据库

### 4. API调用示例

```javascript
const api = require('../../utils/api');

// 获取视频列表
const videos = await api.getVideoList({ page: 1, pageSize: 10 });

// 发布视频
await api.publishVideo({
  title: '视频标题',
  description: '视频描述',
  video_url: 'https://...',
  cover_url: 'https://...'
});
```

## 开发注意事项

### 1. 视频相关
- 视频文件较大，必须使用云存储
- 注意视频审核合规性
- 考虑CDN加速

### 2. 权限相关
- 前端权限控制仅做体验优化
- **后端必须做权限校验**
- 敏感操作需要双重验证

### 3. 性能优化
- 视频列表使用分页加载
- 图片使用懒加载
- 合理使用缓存

### 4. 合规要求
- 视频内容审核（可使用腾讯云内容安全）
- 用户隐私保护
- 数据安全存储

## 待完成事项

### 后端开发
- [ ] 实现所有API接口
- [ ] 配置数据库
- [ ] 实现视频上传到云存储
- [ ] 实现权限校验中间件
- [ ] 实现会员支付功能

### 前端优化
- [ ] 添加加载动画
- [ ] 优化视频播放体验
- [ ] 添加错误处理
- [ ] 完善UI/UX

### 功能扩展
- [ ] 视频分类/标签
- [ ] 搜索功能
- [ ] 关注/粉丝系统
- [ ] 评论系统完善
- [ ] 分享功能

## 技术栈

- **前端**: 微信小程序原生开发
- **后端**: Node.js / Python / Java (需自行开发)
- **数据库**: MySQL + Redis
- **存储**: 腾讯云COS / 阿里云OSS
- **CDN**: 腾讯云CDN

## 相关文档

- [技术方案.md](./技术方案.md) - 详细的技术方案和架构设计
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

## 许可证

MIT License






