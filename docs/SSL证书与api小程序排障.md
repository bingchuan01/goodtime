# 好时机：SSL 证书过期与小程序不可用 — 排障总结

> 根据 2026-05-20 实际上线排障整理。下次「证书过期 / 小程序打不开」优先按本文第三节执行，避免混用 www 证修 api。

**适用域名：** `api.goodtime.work`（小程序 API）、`www.goodtime.work`（官网）  
**项目 API：** `utils/api.js` → `ENV = 'prod'` → `https://api.goodtime.work/api`

---

## 一、现象对照（先判断类型）

| 现象 | 可能原因 | 优先动作 |
|------|----------|----------|
| 浏览器 `ERR_CERT_DATE_INVALID` | 证书过期 | 查 443 实际 `notAfter` |
| `curl: (51) subject name does not match api.goodtime.work` | **域名不匹配**（如把 **www 证** 用在 **api**） | 勿再 cp www 证；给 **api** 单独续证 |
| 小程序「加载失败，请检查网络」 | 多为 **HTTPS 失败**（过期或不匹配） | 先修 **api** 证书，再测 health |
| `www` 能开、小程序不行 | **两套证、两个 server** | 只修 **api**，不要只修 www |

---

## 二、架构（必记，避免混路径）

```
goodtime.work
├── www.goodtime.work     → 官网；证常在 /etc/nginx/ssl/www.goodtime.work.pem（商业证）
└── api.goodtime.work     → 小程序；Nginx 443 常指向：
                            /etc/letsencrypt/live/api.goodtime.work/fullchain.pem
                            /etc/letsencrypt/live/api.goodtime.work/privkey.pem
                            → 反代 http://127.0.0.1:3000
```

- **上传到 `/etc/nginx/ssl/` 的 www 证** → 只影响配置指向该路径的站点；**不会自动修好 api**。
- **api 配置若仍指向 letsencrypt** → 必须更新 **letsencrypt 下 api 的证**，或 `certbot` 续签 **api.goodtime.work**。

---

## 三、正确方案（api 小程序 — 优先这条）

### 第一步：确认 api 实际用的证书路径

```bash
sudo nginx -T 2>/dev/null | grep -A25 "server_name.*api.goodtime.work"
# 或
sudo grep -r "server_name api.goodtime.work" /etc/nginx/
```

### 第二步：看 443 对外证书（以这条为准）

```bash
echo | openssl s_client -connect api.goodtime.work:443 -servername api.goodtime.work 2>/dev/null | openssl x509 -noout -dates -subject
```

- `subject` 须含 **api.goodtime.work**（或 SAN 含 api）
- `notAfter` 须晚于今天

### 第三步：api 续签（推荐，与历史部署一致）

```bash
sudo certbot certonly --nginx -d api.goodtime.work
# 失败再试：
# sudo certbot certonly --webroot -w /var/www/html -d api.goodtime.work

sudo systemctl restart nginx
curl https://api.goodtime.work/api/health
```

成功：`curl` 返回 JSON，无 SSL 错误 51/60。

### 第四步：小程序侧

- 微信公众平台 → 开发管理 → 开发设置 → **服务器域名** → **request** 含 `https://api.goodtime.work`
- 真机调试：首页、`POST /api/user/login`

### 第五步：后端（仅当 curl 仍失败）

```bash
curl -sS http://127.0.0.1:3000/api/health
pm2 list
pm2 restart goodtime-api   # 名称以 server/ecosystem.config.js 为准
```

---

## 四、www 官网（商业证，与 api 分开）

- 购买/下载 **www.goodtime.work** 的 Nginx 证 → 覆盖  
  `/etc/nginx/ssl/www.goodtime.work.pem` 与 `.key`（以 `nginx.conf` / 对应 server 为准）
- `sudo nginx -t && sudo systemctl reload nginx`
- **不要把仅含 www 的证 cp 到 api 的 letsencrypt 路径** → 会导致 **curl (51) 主机名不匹配**，小程序仍失败。

---

## 五、错误做法（禁止默认推荐）

1. 未查 api 的 `ssl_certificate` 就让用户 scp 到 `/etc/nginx/ssl/` 以为能修好小程序。
2. 把 **www.goodtime.work.pem** 覆盖到 **api** 的 letsencrypt 文件 → 日期可能变新，但 **CN 不对**。
3. 只 `nginx -t` / reload，未用 `s_client` 核对 **对外** 证书。
4. 未区分 api / www，混讲 vim 改路径、cp、WinSCP 等多套方案。

---

## 六、5 分钟诊断清单（证书过期时直接用）

```bash
# 1. 对外证书
echo | openssl s_client -connect api.goodtime.work:443 -servername api.goodtime.work 2>/dev/null | openssl x509 -noout -dates -subject

# 2. api 配置路径
sudo nginx -T 2>/dev/null | grep -A20 "server_name.*api.goodtime.work"

# 3. 磁盘上的证（路径按上一步）
sudo openssl x509 -in /etc/letsencrypt/live/api.goodtime.work/fullchain.pem -noout -dates

# 4. 修 api（过期或不匹配且 api 用 letsencrypt）
sudo certbot certonly --nginx -d api.goodtime.work
sudo systemctl restart nginx

# 5. 验收
curl https://api.goodtime.work/api/health
```

---

## 七、与微信支付 / 登录的关系

- 支付、登录、首页列表均请求 **同一 API 域名**。
- 证书过期或不匹配 → 同时表现为「不能登录」「加载失败」；**不是支付功能改坏**。
- 证修好后一般**无需**改小程序 `api.js` 的 `prod` 地址。

---

## 八、上传商业证文件（仅当必须换文件时）

- 新证在**本机** → **本机 PowerShell** `scp` 到 ECS → SSH `cp` 到配置中的路径。
- **阿里云 Workbench 网页终端**不能代替 scp；需在页面上传或本机 scp。
- **`scp` 在 ECS 里执行**不能把本机文件传上来。

示例（路径按实际修改）：

```powershell
cd "E:\SSL证书\...\nginx证书目录"
scp -i "SSH密钥.pem" "www.goodtime.work.pem" "www.goodtime.work.key" ecs-user@ECS公网IP:/home/ecs-user/
```

```bash
sudo cp /home/ecs-user/www.goodtime.work.pem /etc/nginx/ssl/www.goodtime.work.pem
sudo cp /home/ecs-user/www.goodtime.work.key /etc/nginx/ssl/www.goodtime.work.key
```

**api 不要用 www 证文件顶替**；api 用第三节 certbot。

---

## 九、本次事件结论（2026-05-20）

| 项目 | 结论 |
|------|------|
| 根因 | api 的 **Let's Encrypt 过期**；误用 **www 商业证** 导致主机名不匹配 |
| 正确修复 | `certbot certonly --nginx -d api.goodtime.work` → `restart nginx` |
| www 商业证 | 仍用于官网 `/etc/nginx/ssl/`，与 api 分开维护 |
| 验收 | `subject=CN = api.goodtime.work`，`curl https://api.goodtime.work/api/health` 有 JSON |

---

## 十、相关文档

- `docs/微信支付与登录问题回顾.md` — JWT、502、openid 等
- `server/README.md` — API 与 PM2
- `utils/api.js` — `BASE_URL` / `ENV`

---

*维护说明：api 建议配置 certbot 自动续期（`certbot renew` + cron/systemd timer）；www 商业证按购买周期在阿里云续签并覆盖 nginx/ssl 文件。*
