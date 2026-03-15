# OSS 直传接入与排障记录（413 / 404 / 401）

## 背景

发布项目时会上传轮播图、视频封面、视频、以及多张详情长图。线上 `POST /api/upload` 经过 Nginx/网关/服务端限制后会出现 `413 Payload Too Large`，导致小程序端上传失败并提示“服务器响应格式错误”（实为上传接口返回非 JSON，前端 `JSON.parse` 失败）。

为避免经业务服务器转发大文件，改为 **阿里云 OSS 直传**：

- 后端仅负责 **签发上传策略**（policy + signature）
- 小程序使用 `wx.uploadFile` 直接上传到 OSS
- OSS 未配置时自动回退到原 `/api/upload`

## 关键现象与结论

### 1) 为什么多次 404

请求：

- `GET https://api.goodtime.work/api/upload/oss-policy?ext=.jpg`

返回：

- `HTTP/1.1 404 Not Found`
- Body：`Cannot GET /api/upload/oss-policy`

结论：

- 该 404 来自 **Express**（“Cannot GET …”），表示 **线上运行的代码未注册该路由**。
- 即使已经配置了 OSS 环境变量、重启了 pm2，只要线上代码还是旧版本，就会一直 404。

### 2) 为什么后来 401 反而是“成功信号”

当服务器端 `server/routes/upload.js` 已包含：

- `router.get('/oss-policy', auth, ...)`

并且重启进程后再次 curl 得到：

- `HTTP/1.1 401`

结论：

- **401 表示路由已存在且已命中**（不再是 404）。
- 因为该接口走 `auth` 鉴权，curl 未携带小程序 token / `X-User-Id`，所以返回 401 属于预期。

## 排障与验证步骤（按顺序）

### A. 确认线上进程实际目录（ECS 上）

```bash
pm2 list
pm2 show <appName>
```

查看输出中的：

- `exec cwd`（例如 `/home/ecs-user/goodtime/server`）

### B. 确认线上代码是否包含路由（ECS 上，任意目录）

```bash
grep -n "oss-policy" /home/ecs-user/goodtime/server/routes/upload.js
```

- **无输出**：说明线上文件仍旧，需要更新代码/覆盖文件。
- **有输出**：说明线上文件已更新，可继续重启与验证。

### C. 更新代码后重启（ECS 上，server 目录）

```bash
cd /home/ecs-user/goodtime/server
pm2 restart ecosystem.config.js
```

若仍不生效，可用更强方式：

```bash
pm2 delete <appName>
pm2 start ecosystem.config.js
```

### D. 通过接口状态判断当前阶段（ECS 上，任意目录）

```bash
curl -i "https://api.goodtime.work/api/upload/oss-policy?ext=.jpg"
```

- **404**：路由仍不存在（代码未部署/未生效）
- **401**：路由存在但未登录（正常）
- **501**：路由存在但 OSS 环境变量未配置/未生效

## 部署踩坑记录：本机命令 vs ECS 命令

- `/home/ecs-user/...` 这类路径只存在于 **Linux ECS**，不要在本机 Windows 终端执行。
- 本机只做：代码提交/推送、或使用 `scp` 上传文件到 ECS。
- ECS 上做：`git pull`、`pm2 restart`、`curl/grep` 验证。

## 通过 SCP 覆盖文件（当 git pull 不方便时）

若 ECS 只允许密钥登录，需指定私钥：

```bash
scp -i "<key.pem>" "E:\goodtime\server\routes\upload.js" ecs-user@<ECS_IP>:/home/ecs-user/goodtime/server/routes/upload.js
```

覆盖后按上文 C、D 进行重启与验证。

## OSS 直传所需配置

### 1) ECS（Node）环境变量

通过 pm2 的 `ecosystem.config.js` 写入：

- `OSS_REGION`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- 可选：`OSS_HOST`、`OSS_MAX_SIZE`

### 2) 小程序后台（必做）

在「开发管理 → 开发设置 → 服务器域名」中，将 **uploadFile 合法域名** 增加：

- `https://<bucket>.oss-<region>.aliyuncs.com`

否则小程序直传 OSS 会报“域名未配置/不在合法域名”。

