# 好时机后端 API

提供小程序与后台管理所需的接口：用户、项目、分类、配置、站内信、会员、上传、搜索、线索及管理端审核/配置。

## 运行

```bash
cd server
npm install
npm start
```

默认 `http://localhost:3000`，API 前缀 `/api`。正式环境请配置域名并设置 `PORT`。

## 域名与上传（暂不配置固定域名）

- 小程序端 `utils/api.js` 中 `BASE_URL` 为占位地址，**暂不配置当前已有域名**。本地联调时可将 `BASE_URL` 改为 `http://localhost:3000/api`，并在微信开发者工具中勾选「不校验合法域名」。
- 上传接口未设置 `UPLOAD_BASE_URL` 时，返回的 URL 按当前请求 host 生成（如 `http://localhost:3000/uploads/文件名`）。部署时可通过环境变量 `UPLOAD_BASE_URL` 指定静态文件根 URL。

## 数据库

SQLite 文件 `server/goodtime.db`，首次启动自动建表并写入：

- 用户、站内信、项目、分类、配置、订单、线索、管理员。
- 默认管理员：**用户名 `admin`，密码 `admin123`**（首次登录后建议修改）。

## 管理后台

- 本地地址：`http://localhost:3000/admin/`（与 API 同源）
- 功能：登录、项目列表与审核（通过/退回+展区）、项目详情与金盾/展区、分类管理、数据看板/购买须知/权益说明配置、线索列表、**咨询合作站内信**。

## 鉴权

- **小程序端**：`Authorization: Bearer <token>` 或 Header `X-User-Id`（开发联调）。用户登录 `POST /api/user/login` 用 code 换 token。
- **管理端**：`POST /api/admin/login` 用用户名密码换 token，后续请求带 `Authorization: Bearer <adminToken>`。

## 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/user/login | 微信登录，body: `{ code }` |
| GET | /api/user/info | 当前用户信息（需鉴权） |
| GET | /api/user/videos | 我的发布列表（需鉴权） |
| GET | /api/projects | 项目列表（分页、分类、展区） |
| GET | /api/projects/:id | 项目详情 |
| POST | /api/projects | 创建项目/提交审核（需鉴权） |
| PUT | /api/projects/:id | 更新项目（作者，仅退回后可编辑） |
| GET | /api/categories | 分类列表 |
| GET | /api/config/:key | 获取配置（dashboard / purchase_notice / benefits_doc 等） |
| GET/POST/PUT/DELETE | /api/messages/* | 站内信 |
| GET | /api/search/projects | 搜索项目 |
| POST | /api/upload | 文件上传（需鉴权） |
| POST | /api/leads | 提交线索（免费获取品牌资料） |
| POST | /api/admin/login | 管理后台登录 |
| GET | /api/admin/projects | 项目列表（全部状态） |
| PUT | /api/admin/projects/:id/audit | 审核（通过/退回） |
| GET/PUT | /api/admin/config/:key | 配置读写 |
| GET | /api/admin/leads | 线索列表 |
| GET | /api/admin/messages | 咨询合作站内信（发给官方的站内信） |
