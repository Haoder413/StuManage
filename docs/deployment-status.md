# 部署状态记录

更新时间：2026-06-30 CST

## 当前状态

项目已经部署成功，并且可以通过 HTTPS 域名访问。

- 服务器：腾讯云轻量应用服务器
- 系统：Ubuntu
- 公网 IP：1.12.208.46
- 主域名：taotaomath.top
- www 域名：www.taotaomath.top
- 代码仓库：https://github.com/Haoder413/StuManage
- 部署目录：/opt/student-management
- 当前运行目录：/opt/student-management/current
- 应用端口：3001
- Web 入口：Nginx 80/443 反向代理到 127.0.0.1:3001
- 进程管理：PM2
- 数据库：SQLite，当前真实工作区和演示工作区共用同一套数据库，通过 `workspaceId` 隔离数据，不是两套数据库
- 数据与上传文件目录：/opt/student-management/shared
- Word 转 PDF 预览依赖：LibreOffice
- 实例规格：2 核 CPU、4GB 内存
- 系统盘：SSD 云硬盘 60GB
- 流量包：500GB/月
- 峰值带宽：5Mbps
- 到期时间：2027-06-19 16:41:35

## DNS 解析

域名在阿里云购买和解析，服务器在腾讯云。

当前 DNS 记录：

- taotaomath.top -> A -> 1.12.208.46
- www.taotaomath.top -> A -> 1.12.208.46

服务器验证命令：

```bash
nslookup taotaomath.top
nslookup www.taotaomath.top
```

两个域名都应返回：

```text
1.12.208.46
```

## SSL 证书

证书由 Let's Encrypt / Certbot 申请。

- 证书名称：taotaomath.top
- 证书路径：/etc/letsencrypt/live/taotaomath.top/fullchain.pem
- 私钥路径：/etc/letsencrypt/live/taotaomath.top/privkey.pem
- 当前证书到期日：2026-09-18
- Certbot 已创建自动续期任务

检查自动续期：

```bash
sudo certbot renew --dry-run
```

如果需要重新安装证书到 Nginx：

```bash
sudo certbot install --cert-name taotaomath.top
```

## Nginx

Nginx 负责把 80/443 请求转发到本地 Next.js 服务。

站点配置文件：

```text
/etc/nginx/sites-available/student-management
```

启用位置：

```text
/etc/nginx/sites-enabled/student-management
```

关键配置：

```nginx
server_name taotaomath.top www.taotaomath.top;
client_max_body_size 2048m;
client_body_timeout 1800s;
proxy_pass http://127.0.0.1:3001;
proxy_read_timeout 1800s;
proxy_send_timeout 1800s;
proxy_set_header X-Forwarded-Proto $scheme;
```

检查 Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl reload nginx
```

## PM2

应用通过 root 用户下的 PM2 运行。

查看状态：

```bash
sudo pm2 list
```

正常情况下只应有一个进程：

```text
student-management online
```

如果出现多个同名进程，可以清理后重新启动：

```bash
sudo pm2 delete all
cd /opt/student-management/current
sudo PORT=3001 pm2 start npm --name student-management --cwd /opt/student-management/current -- start -- -p 3001
sudo pm2 save
```

## 部署和更新

日常代码更新命令：

```bash
cd /opt/student-management/current
sudo REPO_URL=https://github.com/Haoder413/StuManage.git BRANCH=main bash deploy/deploy-update.sh
```

2026-07-09 教师数据隔离扩展为课程管理、成绩管理、学习进度和排课考勤同步隔离，并新增 `Course.createdById` 字段。部署包含该版本时必须同步 Prisma schema；现有部署更新脚本应执行 Prisma 同步，若手动部署需确认 `npx prisma db push` 已成功。

数据库结构同步说明：当前生产环境只有一套 SQLite 数据库。执行 `npx prisma db push` 会按当前 `DATABASE_URL` 同步这套数据库的表结构；真实工作区和演示工作区都使用同步后的同一套表结构，不存在需要分别迁移的第二套演示数据库。

## 课堂视频 VOD 环境变量

课堂视频回放当前可切换到腾讯云 VOD。VOD 密钥只允许保存在服务器环境变量或服务器 `.env` 文件中，不要写入聊天记录、项目文档或 Git 仓库。

推荐把生产环境变量写入服务器共享配置文件：

```bash
sudo nano /opt/student-management/shared/.env
```

追加或修改以下配置：

```env
LESSON_VIDEO_STORAGE_PROVIDER=vod
TENCENTCLOUD_SECRET_ID=腾讯云 SecretId
TENCENTCLOUD_SECRET_KEY=腾讯云 SecretKey
TENCENT_VOD_SUB_APP_ID=1445113912
TENCENT_VOD_PLAY_DOMAIN=1445113912.vod-qcloud.com
TENCENT_VOD_REGION=ap-guangzhou
LESSON_VIDEO_MAX_MB=2048
```

保存后需要让应用重新读取环境变量。日常推荐重新执行部署更新脚本；如果只是改配置，也可以重启 PM2：

```bash
cd /opt/student-management/current
sudo pm2 restart student-management --update-env
```

如果本地代码已经推送到 GitHub，但服务器还没有更新代码，应执行部署更新脚本，而不是只重启 PM2：

```bash
cd /opt/student-management/current
sudo REPO_URL=https://github.com/Haoder413/StuManage.git BRANCH=main bash deploy/deploy-update.sh
```

部署更新脚本会拉取最新代码、安装依赖、构建项目，并从当前运行目录重新启动 PM2。

配置后验证：

1. 教师端进入“排课考勤”的课后反馈弹窗。
2. 上传一个小的 `.mp4` 测试视频。
3. 家长端进入“时间管理”的对应课程详情，确认“课堂回放”可以播放。

如果 VOD 上传失败，只记录和排查错误提示，不要把 `SecretId` 或 `SecretKey` 发到聊天里。正式上线前建议在腾讯云控制台重新生成播放密钥，因为之前截图里出现过播放密钥。

如果浏览器控制台出现 `413 Request Entity Too Large`，表示请求在 Nginx 层被上传大小限制拦截，通常还没有进入应用代码。现有服务器需要检查并更新 `/etc/nginx/sites-available/student-management`，确保站点配置里包含：

```nginx
client_max_body_size 2048m;
client_body_timeout 1800s;
proxy_read_timeout 1800s;
proxy_send_timeout 1800s;
```

注意：执行 `deploy/deploy-update.sh` 只会更新网站代码和重启 PM2，不会自动覆盖线上已经存在的 Nginx 站点配置。因此如果部署后仍提示“服务器上传上限不足”，需要手动修改服务器的 Nginx 配置，并确认 80/443 对应的实际 server 块都已经生效。

查看当前生效配置：

```bash
sudo nginx -T | grep -n "client_max_body_size\|client_body_timeout\|proxy_read_timeout\|proxy_send_timeout\|server_name\|proxy_pass"
```

如果 100MB 多一点的视频仍然报“服务器上传上限不足”，优先判断为当前生效配置仍有 `client_max_body_size 100m`，或只改了 80/HTTP server 块、实际访问走 443/HTTPS server 块。排查时要确认 `taotaomath.top` 和 `www.taotaomath.top` 对应的 80 与 443 server 块都设置了 `client_max_body_size 2048m`。

如果浏览器实际访问的是 `http://1.12.208.46`，还要确认 `server_name 1.12.208.46 _;` 对应的 IP server 块也设置了 `client_max_body_size 2048m`。2026-07-01 截图中看到域名 server 块已有 `2048m`，但 IP server 块只有 `proxy_pass http://127.0.0.1:3001;`，没有显示 `client_max_body_size`，因此通过 IP 上传 100MB 以上视频仍会报 413。

备案未完成期间，如果临时通过 `http://1.12.208.46` 使用系统，必须优先修改 IP server 块，也就是包含以下配置的块：

```nginx
server_name 1.12.208.46 _;
proxy_pass http://127.0.0.1:3001;
```

该块也要加入：

```nginx
client_max_body_size 2048m;
client_body_timeout 1800s;
proxy_read_timeout 1800s;
proxy_send_timeout 1800s;
```

修改后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

应用自身也有课堂视频大小上限，默认是 `2048MB`，可以在 `/opt/student-management/shared/.env` 中通过 `LESSON_VIDEO_MAX_MB` 调整。修改该环境变量后需要重启 PM2 或重新部署。

部署脚本当前已经修复 PM2 旧进程问题：

- 旧问题：`pm2 restart` 会继续使用旧 release 的工作目录，导致代码更新后服务仍跑旧构建。
- 处理：更新脚本改为先 `pm2 delete`，再从 `/opt/student-management/current` 重新启动。
- 相关提交：`307a0d3 Restart PM2 from the active release`

## 登录问题记录

上线初期出现过“登录后闪一下又回到登录页”的问题。

根因分两层：

1. HTTP 访问时登录 cookie 不应该带 `Secure`，否则浏览器不会保存。
2. PM2 旧进程仍在旧 release 里运行，导致新代码部署后没有真正生效。

修复记录：

- `021188f Fix login cookie on HTTP deployments`
- `d24d3d4 Use proxy headers for secure login cookies`
- `307a0d3 Restart PM2 from the active release`

验证登录 cookie：

```bash
curl -i -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"identifier":"admin","password":"admin123"}' | grep -i set-cookie
```

HTTPS 上线后 cookie 可以带 `Secure`；HTTP 调试时不应带 `Secure`。

## 默认账号

如果服务器执行过 seed，会有以下默认账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 老师 | teacher | teacher123 |
| 家长 | parent | parent123 |
| 演示 | demo | demo123 |

正式使用前应修改默认密码。

## 常用检查

检查应用端口：

```bash
sudo ss -lntp | grep 3001
```

检查本机应用：

```bash
curl -I http://127.0.0.1:3001
```

检查 Nginx HTTP：

```bash
curl -I http://127.0.0.1
```

检查 HTTPS 域名：

```bash
curl -I https://taotaomath.top
curl -I https://www.taotaomath.top
```

正常未登录时，可能返回：

```text
307 Temporary Redirect
Location: /login
```

这是登录权限逻辑正常生效。

## 注意事项

- `docs/` 已加入 `.gitignore`，部署记录只保存在本地，不上传 GitHub。
- 数据库和上传文件不在 Git 仓库中，生产数据位于 `/opt/student-management/shared`。
- 课堂视频保存到共享上传目录下的 `storage/lesson-videos/`；迁移、备份和回滚时需要和 SQLite 数据库一起保留。
- 课堂视频同一条出勤/补课记录只保留一个视频；老师替换上传时会先保存新视频并更新数据库，再清理旧的本地文件、VOD 媒体或 COS 对象。清理失败不应影响新视频保存，但需要通过服务日志排查遗留存储对象。
- 如果后续接入轻量 NAS，推荐把 `storage/lesson-videos/` 迁移为 NAS 挂载目录或由网站后端代理读取 NAS 文件；不要把 NAS 原始公网地址直接暴露给家长端。
- 视频流量口径：当前服务器本地存储方案中，家长播放视频会消耗服务器公网下行流量；老师上传视频会消耗服务器公网入站流量。若视频从家中 NAS 通过网站后端代理播放，则家中 NAS/宽带产生上行流量，服务器同时产生入站和下行流量。若家长直接访问 NAS 公网地址，则主要消耗家中宽带上行，不消耗服务器视频下行，但会绕开网站权限控制，因此不作为推荐方案。
- 当前腾讯云轻量应用服务器为 2 核 4GB、60GB SSD、500GB/月流量包、5Mbps 峰值带宽。按视频播放场景估算，5Mbps 更适合 1 路中等清晰度在线播放，多个家长同时看回放时容易触顶；500GB/月大约可支撑 500 个 1GB 视频的完整播放流量，实际还要扣除网页、接口和其他文件访问流量。
- 2026-06-30 确认的新偏好：用户希望课堂视频有稳定播放来源。推荐后续从“服务器本地存储”升级到腾讯云云点播 VOD；如果控制成本和实现复杂度，则可先采用腾讯云 COS + CDN。网站继续负责课堂和学习关系权限，前端只拿短期有效播放地址，不直接暴露长期公开文件链接。
- 2026-06-30 费用倾向：当前用户量不多时，推荐优先评估 COS + CDN，而不是直接上 VOD。估算口径：若课堂视频总存储约 100GB、每月播放约 100GB，COS + CDN 大致是几十元/月量级；VOD 在同等存储和播放外，还可能产生一次性转码费用，20 个 60 分钟 720p 视频的普通转码约 39 元。若后续需要自动转码、多清晰度、播放器统计和更完整的视频能力，再升级 VOD。
- 2026-06-30 计费口径：腾讯云 COS 支持按量计费（后付费）和资源包（预付费），资源包优先抵扣，超出后按量计费；CDN 也支持预付费流量包和按量后付费，基础计费可选按流量或按带宽，默认通常按小时结算；VOD 也可按实际存储、分发、转码等用量计费，并可购买相应资源包抵扣。当前小规模课堂回放建议先按量观察 1-2 个月，或购买小额 COS 存储包 + CDN 流量包控制预算。
- 2026-06-30 后续配置方向：用户希望协助配置稳定课堂视频播放来源。当前优先路线为腾讯云 COS + CDN：COS 存储课堂视频，CDN 负责稳定分发，网站继续负责学习关系权限校验并生成短期有效播放地址。
- 2026-06-30 域名限制：用户域名仍在备案中，且已开通 COS 存储桶和 CDN。备案通过前，不把 `video.taotaomath.top` 之类的自有 CDN 播放域名作为上线前置条件；过渡期可继续使用服务器本地存储，或先使用私有 COS Bucket 的默认域名/签名 URL 小范围测试。CDN 加速入口通常需要域名，IP 不能替代自定义加速域名；IP 更适合作为源站地址。正式给家长稳定开放时，等备案通过后再绑定自有 CDN 加速域名并配置 HTTPS、防盗链或签名 URL。
- 2026-06-30 即刻使用 CDN 的限制：如果当前没有已备案可用域名，不能直接用服务器 IP 作为正式 CDN 加速域名。可选临时方案是：使用已备案的其他域名或子域名接入 CDN；如果腾讯云控制台提供 COS 默认加速域名，可仅用于小范围测试；或选择境外加速节点测试，但国内家长访问稳定性和合规性不作为正式方案。正式面向家长仍以备案通过后的 `video.taotaomath.top` 为目标。
- 2026-06-30 VOD 过渡判断：用户询问是否可以先使用云点播 VOD。结论是可以优先改为 VOD 路线，用 VOD 承担视频存储、转码和播放分发；网站仍负责学习关系权限校验。备案通过前可先使用 VOD 提供的播放能力或默认播放域名做小范围测试，备案通过后再绑定自有播放域名。
- 2026-06-30 视频存储迁移偏好：用户希望现在先用 VOD，后期改成 COS + CDN。可行，但实现时必须使用统一的 `LessonVideo` 业务模型和视频存储适配层，避免页面直接依赖 VOD 的 `FileId`。数据库应记录 `storageProvider`（如 `local`、`vod`、`cos`）、`vodFileId`、`cosObjectKey`、播放域名/来源等字段。这样后期从 VOD 切到 COS + CDN 主要替换上传、删除、播放地址生成逻辑，家长端页面和学习关系权限逻辑基本不动。
- 2026-06-30 VOD 费用细化：按腾讯云云点播新版按量计费口径估算，中国境内标准存储约 0.0048 元/GB/日；媒体分发加速 0-500GB 日阶梯约 0.24 元/GB；普通转码 H.264 720p 约 0.032 元/分钟，1080p 约 0.061 元/分钟。小规模课堂回放示例：20 条 60 分钟视频，转 720p 一次约 38.4 元；若累计存储 100GB，存储约 14.4 元/月；若家长每月播放 100GB，分发约 24 元/月。实际费用以腾讯云账单和资源包抵扣为准。
- 2026-06-30 VOD 资源包购买建议：用户当前看到首单特惠页面，包含 1 元点播体验包、99 元 1TB 点播流量包、49 元 100GB 点播存储包。当前用户量不多，推荐先买 1 元点播体验包跑通上传、转码和播放链路；暂不建议立刻买 1TB 流量包。若确认要把真实课堂视频长期放到 VOD，且预计很快超过体验包存储额度，可再买 100GB 存储包。流量包等家长实际播放量稳定后再补。
- 2026-06-30 VOD 开通状态：用户已购买 1 元点播体验包并开通 VOD。当前 VOD SubAppId 为 `1445113912`，默认分发协议为 HTTPS，默认播放域名为 `1445113912.vod-qcloud.com`。截图中出现播放密钥，密钥不写入文档；正式上线前建议在控制台重新生成播放密钥，并只配置到服务器环境变量。
- 2026-06-30 VOD 接入环境变量：服务器 `/opt/student-management/shared/.env` 需要配置 `LESSON_VIDEO_STORAGE_PROVIDER=vod`、`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_VOD_SUB_APP_ID=1445113912`、`TENCENT_VOD_PLAY_DOMAIN=1445113912.vod-qcloud.com`，可选 `TENCENT_VOD_REGION=ap-guangzhou` 和 `TENCENT_VOD_PROCEDURE`。SecretId 和 SecretKey 只写入服务器环境变量，不写入 Git、文档或聊天记录。
- 2026-06-30 视频上传问题处理：线上上传课堂视频时浏览器返回 `413 Request Entity Too Large`，根因是 Nginx 上传大小限制。部署模板已调整为 `client_max_body_size 2048m`，并增加 1800 秒上传/代理超时；现有服务器需要同步修改 Nginx 配置并 reload。
- 2026-06-30 视频大小上限补充：应用层原先固定限制为 500MB，已调整为默认 2048MB，并支持通过服务器环境变量 `LESSON_VIDEO_MAX_MB` 调整。若前端提示“视频超过系统上传上限”，应压缩视频或提高该环境变量后重启应用。
- 2026-06-30 100MB 级视频仍提示“服务器上传上限不足”：用户确认视频只有一百多 MB，若仍失败，最可能是 Nginx 当前生效 server 块仍保留 `client_max_body_size 100m`，尤其是 HTTPS 443 配置没有同步修改。
- 2026-07-01 继续排查 413：用户截图显示浏览器请求地址为 `http://1.12.208.46/api/attendance/.../video`，实际命中 IP server 块；`nginx -T` 输出中域名块已有 `client_max_body_size 2048m`，但 `server_name 1.12.208.46 _;` 的 IP 块未显示该配置。需要在 IP server 块中也加入上传大小与超时配置，或改用已配置好的域名访问。
- 2026-07-01 备案期间临时访问规则：用户确认域名仍在备案中，当前应继续使用 IP 访问。因此线上视频上传限制应修改 IP server 块，而不是只修改域名 server 块。
- 2026-07-01 备案通过后的访问规则：用户确认域名备案已通过，正式访问入口应切回 `taotaomath.top` / `www.taotaomath.top`，Nginx 以 `/etc/nginx/sites-available/student-management` 域名站点配置为主；`student-management-ip` 仅保留为临时兜底或关闭。切换前需要确认域名解析到 `1.12.208.46`、域名 server 块包含课堂视频上传所需的 `client_max_body_size 2048m` 和 1800 秒超时配置、证书有效，并 reload Nginx。
- 2026-07-01 公安联网备案服务类型：网站面向学生管理、课程安排、家长端查看学习情况和课堂回放，属于教育相关在线服务，不是网络接入、IDC、云计算、域名解析等网络基础服务商。备案表单中“是否提供互联网交互服务”可按实际登录、上传、家长查看等交互功能选择“是”；网站类型优先选择“生活服务类 C”下的教育相关类别，不选择“网络基础类 A”。
- 2026-07-01 视频 CDN 域名规划：用户准备从 VOD 切换到 COS + CDN，`video.taotaomath.top` 可作为正式视频加速域名启用。推荐用途是只服务课堂视频静态资源，主站仍使用 `taotaomath.top` / `www.taotaomath.top`。切换前需要在腾讯云 CDN 添加 `video.taotaomath.top`，源站指向 COS 存储桶，DNS 为 `video` 子域添加 CDN 提供的 CNAME，并配置 HTTPS 证书、防盗链或签名 URL；网站后端仍负责家长权限校验，不在页面中暴露长期公开原始 COS 链接。
- 2026-07-01 公开首页部署口径：根路径 `/` 为公开首页，不再由中间件重定向到登录页；后台仪表盘改为 `/dashboard`。线上验证时，访问 `https://taotaomath.top/` 应看到顶部免责声明和下方公开资料卡片，访问后台登录需直接打开隐藏地址 `/teacher-login-2026`。
- 2026-07-01 登录入口隐藏：旧地址 `/login` 默认不显示登录表单，未登录访问后台会回到公开首页；后台登录地址由服务器环境变量 `HIDDEN_LOGIN_PATH` 控制，默认值为 `/teacher-login-2026`。服务器配置位置为 `/opt/student-management/shared/.env`，例如 `HIDDEN_LOGIN_PATH="/teacher-login-2026"`；如果不需要隐藏入口，可改为 `HIDDEN_LOGIN_PATH="/login"`。修改后需要重新部署或使用 `sudo pm2 restart student-management --update-env` 重启应用。
- 2026-07-03 自定义隐藏入口部署口径修正：线上曾出现把 `HIDDEN_LOGIN_PATH` 改为 `prdaedEFWRSACasdas` 后新地址 404、默认 `/teacher-login-2026` 仍返回 200 的情况。后续代码增加运行时隐藏入口兜底页：未知路径会先进入运行时页面读取当前 `HIDDEN_LOGIN_PATH`，匹配时显示登录页，不匹配时回公开首页；部署该版本后，后续只改隐藏入口并重启 PM2 即可生效。
- 2026-07-03 默认隐藏入口关闭规则：默认 `/teacher-login-2026` 是登录页真实路由，但现在会在服务端校验当前 `HIDDEN_LOGIN_PATH`；当服务器配置为自定义隐藏入口时，旧默认地址不再显示登录页，而是回公开首页。
- 2026-07-04 自定义隐藏入口布局修复：自定义隐藏入口通过运行时兜底页显示登录表单时，如果浏览器仍有登录会话，根布局原先只识别 `/teacher-login-2026` 为全屏登录页，导致左侧后台菜单和登录表单同时出现。已改为由服务端把当前 `HIDDEN_LOGIN_PATH` 传给前端外壳和侧边栏，当前隐藏入口始终按全屏登录页处理。
- 2026-07-03 隐藏入口稳定性修复：隐藏登录路径匹配会先规范化尾部斜杠，`/teacher-login-2026` 和 `/teacher-login-2026/` 都应进入同一登录页；自定义 `HIDDEN_LOGIN_PATH` 也同样支持带或不带尾部斜杠访问。
- 2026-07-03 退出登录跳转调整：退出接口清除会话后返回当前隐藏登录入口，而不是公开首页 `/`；如果服务器配置了自定义 `HIDDEN_LOGIN_PATH`，退出后会回到该自定义入口。
- 2026-07-04 家长端考勤与课堂视频显示修复：老师端考勤保存现在会持久化解析到的 `learningLinkId`，避免重复保存生成多条空学习关系考勤；家长首页和时间管理接口会兼容历史 `learningLinkId=null` 的考勤并去重，优先展示带课堂视频或已绑定学习关系的记录。部署后家长应在“时间管理”对应日期右侧课程详情的“课堂回放”区域查看老师上传的视频。
- 2026-07-04 家长端学习档案入口：家长端左侧新增“学习档案”，路由为 `/parent/archive`，用于集中查看历史课堂、课堂回放和课堂笔记式内容；资料/讲义/笔记文件仍通过现有“资料中心”授权和预览下载流程查看。
- 2026-07-01 登录页审核细节：隐藏登录页账号输入框不再展示 `teacher / parent / demo` 示例占位文字，并移除“查看网站免责声明”按钮；登录页右侧免责声明和公开首页顶部免责声明保留。
- 2026-07-01 只展示首页的登录关闭口径：`HIDDEN_LOGIN_PATH` 只控制登录入口路径，不是禁用登录开关；删除该变量会回退到默认 `/teacher-login-2026`。应用已增加 `LOGIN_ENABLED` 开关，默认 `true`；设置 `LOGIN_ENABLED="false"` 时，登录页访问会回到公开首页，`/api/auth/login` 返回 404。`.env` 不会随代码推送，也不会被部署脚本覆盖；需要在服务器 `/opt/student-management/shared/.env` 手动修改。首次增加该代码开关需要重新部署一次；之后只修改变量值时一般执行 `sudo pm2 restart student-management --update-env` 即可，如果重启后仍不生效，应执行完整 `deploy-update.sh`。
- 2026-07-01 公开首页资料目录：公开首页资料不走后台资料库，读取共享目录 `/opt/student-management/shared/storage/public-materials`。部署脚本会创建该目录并在每个 release 中软链到 `storage/public-materials`。用户可直接通过服务器文件管理或 SFTP 上传公开展示文件；支持 `.pdf`、`.html`、`.htm`、`.doc`、`.docx`、`.png`、`.jpg`、`.jpeg`、`.webp`。
- 2026-07-05 课堂视频和课堂资料都属于运行数据，不随代码 release 存放。部署脚本需要创建并软链 `/opt/student-management/shared/storage/lesson-videos` 与 `/opt/student-management/shared/storage/lesson-attachments`，避免下次发布时丢失老师上传的视频或课堂资料。
- 2026-07-01 ICP 备案号悬挂：公开首页底部展示 `辽ICP备2026013992号`，链接到工信部备案查询网站 `https://beian.miit.gov.cn/`。
- 2026-07-01 VOD 上传失败新现象：Nginx 上传大小问题修复后，浏览器网络面板显示 `/api/attendance/.../video` 响应 `{"error":"i is not a function"}`。这说明请求已进入应用，失败发生在服务器调用腾讯云 VOD 上传 SDK 阶段，而不是 Nginx 或浏览器上传大小限制。需要通过 `sudo pm2 logs student-management --lines 100` 查看服务器堆栈进一步定位。
- 2026-07-01 VOD 上传失败堆栈确认：PM2 日志出现 `Lesson video upload failed`，错误信息为 `i is not a function`，堆栈位于 `.next/server/chunks/... doRequest`。判断为腾讯云 VOD/COS Node SDK 被 Next.js 生产构建打包进服务端 chunk 后内部请求函数异常。修复方向是在 Next 配置中把 `vod-node-sdk`、`tencentcloud-sdk-nodejs`、`cos-nodejs-sdk-v5` 配置为服务端外部依赖，重新构建部署后再验证上传。
- 2026-07-01 VOD 上传鉴权错误确认：重新部署服务端外部依赖修复后，PM2 日志变为腾讯云真实错误 `The SecretId is not found, please ensure that your SecretId is correct.`。这说明 VOD SDK 已正常向腾讯云发起请求，当前失败点是服务器 `/opt/student-management/shared/.env` 中的 `TENCENTCLOUD_SECRET_ID` 或 `TENCENTCLOUD_SECRET_KEY` 配置不正确、密钥已删除/禁用，或使用了不属于当前腾讯云账号/VOD 子应用的密钥。处理时需要在腾讯云“访问管理 CAM / API 密钥管理”重新确认或新建 SecretId/SecretKey，并重启应用；密钥不得写入 Git、项目文档或聊天记录。
- 2026-07-01 视频上传链路体验判断：当前网站 VOD 上传链路是“浏览器上传到服务器，服务器再上传到腾讯云 VOD”，大视频会受老师当前网络上行、服务器临时磁盘和服务器到腾讯云链路影响。可考虑增加“从 URL 导入/VOD 拉取上传”能力：老师先把视频放到 NAS 或其他可公网访问地址，网站记录课堂归属并调用 VOD `PullUpload` 让腾讯云从该 URL 拉取，减少浏览器长时间上传。
- 2026-07-01 腾讯会议回放链接判断：普通腾讯会议“播放页/分享页”链接通常不是直接视频文件 URL，VOD `PullUpload` 不能稳定直接拉取；可行路径是拿到无需登录、无需 Cookie、无需验证码的录制文件直链/下载链接，或后续接入腾讯会议开放接口获取云录制文件下载地址。第一版如做“从链接导入”，应优先支持 NAS/对象存储/直链视频 URL，腾讯会议普通播放页只作为外部链接记录或后续专项集成。
- 2026-07-01 视频上传测试与 COS + CDN 切换现状：审核期间公开首页和隐藏登录入口保持不变，视频上传测试应从隐藏地址 `/teacher-login-2026` 登录后在老师端小范围进行。本地可用 `LESSON_VIDEO_STORAGE_PROVIDER=local` 测试上传和播放业务流程；真实 COS + CDN 需要在线上使用腾讯云存储桶、CDN 加速域名和 HTTPS 配置验证。当前代码中的 `cos` 分支仅为预留入口，设置 `LESSON_VIDEO_STORAGE_PROVIDER=cos` 会进入未配置状态，正式切换前必须先实现 COS 上传、删除、播放地址生成适配器。目标视频域名仍为 `video.taotaomath.top`，源站指向 COS 存储桶，网站后端负责权限校验并返回 CDN 播放地址或短期签名地址。
- 2026-07-02 当前配置方向更新：用户确认之前 VOD 方式配置失败，下一步改为协助配置腾讯云 COS + CDN。目标架构为 COS Bucket 保存课堂视频对象，CDN 使用视频专用域名分发，网站接口仍先校验老师/家长权限，再返回短期可播放地址或跳转地址。腾讯云 SecretId、SecretKey、Bucket 名称中可能含账号信息的部分、签名密钥等敏感信息只允许写入服务器环境变量或控制台，不写入 Git、项目文档或聊天记录。
- 2026-07-02 COS 存储桶状态：用户确认课堂视频用腾讯云 COS 存储桶已创建，地域为广州。后续服务器环境变量和 COS SDK 配置应使用广州地域；完整 Bucket 名称、AppId、SecretId、SecretKey、CDN 签名密钥等敏感信息只保存到服务器 `/opt/student-management/shared/.env` 或腾讯云控制台。
- 2026-07-02 视频二级域名说明：`video.taotaomath.top` 是已购买主域名 `taotaomath.top` 下的二级域名，不需要单独购买。需要在当前 DNS 解析服务商处新增 `video` 主机记录，通常按腾讯云 CDN 提供的目标地址配置为 CNAME；随后在腾讯云 CDN 和证书配置中启用该域名。
- 2026-07-02 CDN 回源鉴权说明：回源鉴权是 CDN 节点向源站 COS 取文件时使用的鉴权，解决的是“CDN 能不能从私有 COS Bucket 读取对象”的问题；它不等同于家长访问权限控制。家长端仍应先访问网站接口，由网站校验学习关系和课堂权限，再返回短期播放地址。用户访问侧还可另配 CDN URL 鉴权/防盗链，用来减少播放链接被长期外传。
- 2026-07-02 CDN 域名解析阶段说明：腾讯云提示新增 TXT 记录通常是域名归属验证，用来证明当前账号有权配置 `video.taotaomath.top`，不是最终流量解析。CDN 部署完成后仍需要把 `video.taotaomath.top` 的 DNS 记录配置为 CNAME，指向腾讯云 CDN 页面给出的 `video.taotaomath.top.cdn.dnsv1.com`。不要同时为同一个 `video` 主机记录保留 A 记录和 CNAME 记录。
- 2026-07-02 用户确认腾讯云 CDN、DNS 相关配置已按提示完成。下一步应先做控制台侧验证：确认 CDN 状态已部署完成、`video.taotaomath.top` 已 CNAME 到腾讯云 CDN、HTTPS 证书已启用、COS 测试视频可通过 CDN 域名访问；验证通过后再修改应用代码接入 COS 上传和 CDN 播放地址生成。
- 2026-07-02 `video.taotaomath.top` 的 CDN HTTPS 证书配置：在腾讯云 CDN 域名管理中进入 `video.taotaomath.top`，打开“HTTPS 配置”，开启 HTTPS 服务并选择/申请覆盖该域名的证书。若腾讯云证书管理中已有 `*.taotaomath.top` 通配符证书或单域名 `video.taotaomath.top` 证书，可直接选择；否则在腾讯云 SSL 证书中申请免费 DV 证书，按提示做 DNS 验证后回到 CDN 绑定。建议开启 HTTP 到 HTTPS 强制跳转；源站为 COS 时回源协议建议使用 HTTPS，私有 COS Bucket 需开启私有存储桶访问/回源鉴权。
- 2026-07-02 用户截图确认 `video.taotaomath.top` 的 CDN HTTPS 服务已开启，证书来源为腾讯云托管证书，证书状态为配置成功，到期时间为 2026-09-30 21:59:59。该证书用于 CDN 边缘节点，不同于服务器 Nginx 上 `/etc/letsencrypt/live/taotaomath.top/` 的主站证书。
- 2026-07-02 CDN HTTPS 高级开关建议：`video.taotaomath.top` 初次接入 COS + CDN 时，HSTS 暂不建议立即开启，等 HTTPS、CNAME、测试对象访问和应用代码接入都稳定后再考虑开启；OCSP 装订可以开启，用于提升浏览器验证证书状态的效率，风险较低。
- 2026-07-03 私有 COS Bucket 访问预期：如果存储桶设置为私有读，上传文件后直接访问 COS 原始对象地址应返回无权限或签名错误，这是正常安全表现。测试时要区分三种路径：COS 原始公开访问应失败；带有效签名的 COS 临时 URL 应成功；配置了私有存储桶访问/回源鉴权的 CDN 域名应由 CDN 代表用户回源读取，是否还需要用户侧 URL 鉴权由业务安全策略决定。
- 2026-07-03 用户截图确认课堂视频 COS Bucket 当前公共权限为“私有读写”，这是推荐状态。Policy 权限设置当前为空也可以先保持，不要为了测试播放改成“公有读”。后续应用上传需要使用服务器侧腾讯云密钥写入 COS；家长播放则由网站先校验学习关系，再返回 CDN/签名播放地址。
- 2026-07-03 代码侧 COS 存储适配已实现：`LESSON_VIDEO_STORAGE_PROVIDER=cos` 时，老师上传课堂视频会由服务器写入腾讯云 COS；数据库保存 `storageProvider=cos` 和 `cosObjectKey`；家长播放仍先经过 `/api/lesson-videos/:id/file` 权限校验，再重定向到短期有效的 COS 签名地址。服务器 `/opt/student-management/shared/.env` 需要配置 `TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION=ap-guangzhou`、`TENCENT_COS_PUBLIC_BASE_URL=https://video.taotaomath.top`、`LESSON_VIDEO_PLAYBACK_EXPIRES_SECONDS=600` 和 `LESSON_VIDEO_MAX_MB=2048`；密钥和完整 Bucket 名称不写入 Git、文档或聊天记录。
- 2026-07-03 COS 环境变量取值位置：`TENCENTCLOUD_SECRET_ID` 和 `TENCENTCLOUD_SECRET_KEY` 从腾讯云控制台右上角账号头像进入“访问管理/CAM”或“API 密钥管理”获取，建议新建子用户或最小权限密钥，只授权课堂视频 Bucket 的对象读写；`TENCENT_COS_BUCKET` 从对象存储 COS 的存储桶列表或存储桶概览页复制完整 Bucket 名称，通常形如 `名称-数字AppId`。这些值只填写到服务器 `/opt/student-management/shared/.env`，不要发到聊天、文档或 Git。
- 2026-07-03 用户确认服务器 COS 相关环境变量已配置完成。上传测试前需要确认服务器已经部署包含 COS 适配器的最新代码，并执行部署更新或 `pm2 restart student-management --update-env` 让进程读取最新 `.env`。
- 新服务器空库可以执行 seed；有真实数据后不要随意执行 `RUN_SEED=1`。
- 腾讯云安全组需要放行 22、80、443。
- 作业批改中的 Word 题目/答案预览会优先调用 LibreOffice 转 PDF；如果服务器没有安装 LibreOffice，需要执行 `sudo apt-get install -y libreoffice` 后重新上传或刷新预览。
