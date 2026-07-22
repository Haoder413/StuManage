# 服务器部署说明

推荐服务器系统：`Ubuntu 22.04 LTS`。

本项目使用 Next.js、Prisma、SQLite、PM2 和 Nginx。生产环境中，SQLite 数据库和上传的资料文件会统一放在 `/opt/student-management/shared` 目录，避免每次更新代码时覆盖真实数据。

## 1. 把代码发布到 GitHub 或码云

先在 GitHub 或码云创建一个空仓库，然后在本地项目目录执行：

```bash
./deploy/publish-repo.sh <REMOTE_URL> main
```

示例：

```bash
./deploy/publish-repo.sh git@github.com:yourname/student-management.git main
./deploy/publish-repo.sh git@gitee.com:yourname/student-management.git main
```

如果你使用 HTTPS 仓库地址，也可以写成：

```bash
./deploy/publish-repo.sh https://gitee.com/yourname/student-management.git main
```

## 2. 服务器首次初始化

登录 Ubuntu 22.04 服务器后，先把仓库 clone 到服务器，然后在项目目录执行：

```bash
sudo env REPO_URL=<REMOTE_URL> BRANCH=main APP_ROOT=/opt/student-management PORT=3001 bash deploy/server-init.sh
```

这个脚本会自动完成：

- 安装 Node.js 20
- 安装 Git、Nginx、SQLite
- 安装 PM2
- 创建 `/opt/student-management` 目录结构
- 创建生产环境 `.env`
- 拉取代码并构建项目
- 启动服务
- 写入 Nginx 反向代理配置
- 安装每天 03:30 执行的设备历史清理任务

完成后可以通过服务器 IP 访问：

```text
http://你的服务器IP
```

初始化脚本配置的 Nginx 会覆盖并转发真实协议和客户端 IP，同时在共享环境文件中写入：

```env
TRUST_PROXY_HEADERS="true"
```

因此 HTTP 访问会使用普通 HttpOnly Cookie，配置 HTTPS 证书后会根据 Nginx 转发的 `X-Forwarded-Proto=https` 自动使用 Secure Cookie。生产公网建议启用 HTTPS。

已经部署过旧版本的服务器首次上线设备登录功能时，需要单独安装一次每日维护任务：

```bash
sudo grep -q '^TRUST_PROXY_HEADERS=' /opt/student-management/shared/.env || \
  echo 'TRUST_PROXY_HEADERS="true"' | sudo tee -a /opt/student-management/shared/.env >/dev/null
cd /opt/student-management/current
sudo bash deploy/install-maintenance-cron.sh
sudo pm2 restart student-management --update-env
```

检查任务是否已正确写入：

```bash
cat /etc/cron.d/student-management-maintenance
```

设备历史清理日志位于 `/opt/student-management/backups/device-cleanup.log`。本项目的 PM2 由 root 统一管理，后续常规更新也必须使用下文的 `sudo env ... deploy-update.sh` 命令。

## 3. 空数据库初始化

部署脚本默认会执行：

```bash
sudo env -u DATABASE_URL bash -lc 'cd /opt/student-management/current && npx prisma db push'
```

该命令会清除调用 shell 中的 `DATABASE_URL`，由当前版本链接的共享 `.env` 提供数据库配置。如果数据库文件不存在，它会创建一个新的 SQLite 空库，并同步当前表结构。

默认情况下，部署脚本不会执行 seed，因此不会清空或重建数据。

如果你希望新服务器生成默认演示账号和测试数据，可以只在首次部署后执行一次：

```bash
sudo env REPO_URL=<REMOTE_URL> RUN_SEED=1 APP_ROOT=/opt/student-management APP_NAME=student-management PORT=3001 bash /opt/student-management/current/deploy/deploy-update.sh
```

注意：有真实业务数据后，不要再使用 `RUN_SEED=1`，因为 seed 会重建数据。

## 4. 后续正常升级

本地修改代码后，先推送到 GitHub 或码云：

```bash
./deploy/publish-repo.sh <REMOTE_URL> main
```

然后在服务器执行：

```bash
sudo env REPO_URL=<REMOTE_URL> BRANCH=main APP_ROOT=/opt/student-management APP_NAME=student-management PORT=3001 bash /opt/student-management/current/deploy/deploy-update.sh
```

升级脚本会自动完成：

- 备份当前 SQLite 数据库
- 拉取最新代码到新的 release 目录
- 安装依赖
- 生成 Prisma Client
- 同步数据库结构
- 执行幂等的设备会话迁移
- 构建 Next.js 项目
- 切换当前版本
- 重启 PM2 服务

设备登录功能首次上线时，`device-session-v1` 迁移会让全部账号退出一次，以便新会话绑定设备。标记写入成功后，后续更新不会再让用户退出。现有服务器可手动验证幂等性：

```bash
sudo env -u DATABASE_URL bash -lc 'cd /opt/student-management/current && npm run devices:migrate'
sudo env -u DATABASE_URL bash -lc 'cd /opt/student-management/current && npm run devices:migrate'
```

第二次应输出 `{"clearedSessions":0,"alreadyApplied":true}`。如遇到 Prisma Client 的 `EACCES` 或 SQLite 的 `readonly database`，请按项目根目录 `README.md` 中的“设备登录功能首次上线”命令，将 release 依赖和 shared 数据库权限修正为实际运行 PM2 的用户，不要使用 `chmod 777`。

发布会先完成新 release 的安装和构建，再用 `flock` 保护的短暂停机窗口停止旧 PM2，通过 SQLite `.backup` 备份后执行结构同步和迁移。健康检查失败会自动恢复 `previous` release。迁移标记不随代码回退；如果临时恢复旧版，应修复后尽快重新发布。旧进程在窗口内产生的无设备会话会被新版拒绝，过期后由每日任务清理。

## 5. 回滚到上一个版本

如果更新后发现问题，可以执行：

```bash
sudo env -u DATABASE_URL APP_ROOT=/opt/student-management APP_NAME=student-management PORT=3001 bash /opt/student-management/current/deploy/rollback.sh
```

这个脚本会把 `current` 切换回上一个 release，并重启 PM2。

如果这次升级同时改变了数据库结构，必要时还需要从 `/opt/student-management/backups` 恢复对应的数据库备份。

## 6. 重要目录

- 当前运行版本：`/opt/student-management/current`
- 历史版本：`/opt/student-management/releases`
- 环境变量：`/opt/student-management/shared/.env`
- SQLite 数据库：`/opt/student-management/shared/dev.db`
- 上传文件：`/opt/student-management/shared/storage/resources`
- 数据库备份：`/opt/student-management/backups`

后台登录入口由 `/opt/student-management/shared/.env` 中的 `HIDDEN_LOGIN_PATH` 和 `LOGIN_ENABLED` 控制。修改配置：

```bash
sudo nano /opt/student-management/shared/.env
```

默认隐藏登录地址：

```env
HIDDEN_LOGIN_PATH="/teacher-login-2026"
LOGIN_ENABLED="true"
```

使用普通登录地址 `/login`：

```env
HIDDEN_LOGIN_PATH="/login"
LOGIN_ENABLED="true"
```

审核期间只展示公开首页、不开放登录页和登录接口：

```env
LOGIN_ENABLED="false"
```

修改 `.env` 后重启服务：

```bash
sudo pm2 restart student-management --update-env
```

如果服务器还没有部署包含 `LOGIN_ENABLED` 的最新代码，先执行完整更新：

```bash
sudo env REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main APP_ROOT=/opt/student-management APP_NAME=student-management PORT=3001 bash /opt/student-management/current/deploy/deploy-update.sh
```

注意：

- `.env` 不会推送到远端仓库，也不会被部署脚本覆盖；需要在服务器 `/opt/student-management/shared/.env` 手动修改。
- `HIDDEN_LOGIN_PATH` 只用于修改登录路径，不用于关闭登录。删除或留空该变量会回到默认隐藏入口 `/teacher-login-2026`。
- 首次增加登录开关代码需要重新部署一次；之后只调整 `.env` 变量值时一般重启 PM2 即可。如果重启后仍不生效，再执行一次完整更新。

## 7. 常用账号提醒

如果执行过 seed，默认会生成：

- `admin / admin123`
- `teacher / teacher123`
- `parent / parent123`
- `demo / demo123`

正式上线前请登录后台修改默认密码。

## 8. 补齐历史课程归属

如果启用教师数据隔离后，历史课程因为 `createdById` 为空而未显示，可在服务器当前版本目录先预览课程归属推断结果：

```bash
cd /opt/student-management/current
node scripts/backfill-course-ownership.mjs --workspace=default-real
```

脚本根据课程已绑定的有效学习关系、选课学生的创建老师和有效学习关系收集候选老师。如果这些历史数据都为空，但课程所在工作区只有一个普通老师，则使用该唯一老师作为安全兜底。只有候选老师唯一时才允许补齐；无法唯一判断时会显示 `SKIP`，不会自动修改。

确认所有 `ASSIGN` 项目正确后执行：

```bash
node scripts/backfill-course-ownership.mjs --workspace=default-real --apply
```

也可以只处理指定课程：

```bash
node scripts/backfill-course-ownership.mjs --course=<课程ID>
node scripts/backfill-course-ownership.mjs --course=<课程ID> --apply
```

执行 `--apply` 前应先确认 `/opt/student-management/backups` 中已有最新数据库备份。脚本只更新当前 `createdById` 为空且归属唯一的课程，不覆盖已有课程归属。

## 9. 课程视频 CDN 鉴权切换

课程视频使用腾讯云 CDN Type D 鉴权。网站仍先检查登录状态和课程权限，通过后才生成临时播放地址；CDN 控制台将地址有效时间限制为 `7200` 秒。鉴权密钥只保存在腾讯云和服务器共享环境文件中，不要提交到 Git，也不要在截图中显示。

### 9.1 第一次部署：先保持鉴权关闭

先正常部署包含 CDN 鉴权能力的新版本。随后输入准备在腾讯云 CDN 使用的随机密钥，终端输入过程不会回显：

```bash
read -rsp '请输入与腾讯云 CDN Type D 完全相同的鉴权密钥：' TENCENT_CDN_KEY
echo
sudo sed -i '/^TENCENT_CDN_URL_AUTH_ENABLED=/d' /opt/student-management/shared/.env
sudo sed -i '/^TENCENT_CDN_URL_AUTH_KEY=/d' /opt/student-management/shared/.env
printf 'TENCENT_CDN_URL_AUTH_ENABLED=false\nTENCENT_CDN_URL_AUTH_KEY=%s\n' "$TENCENT_CDN_KEY" \
  | sudo tee -a /opt/student-management/shared/.env >/dev/null
unset TENCENT_CDN_KEY
```

这里必须先写入 `TENCENT_CDN_URL_AUTH_ENABLED=false`。此时线上继续使用原有 COS 签名兼容路径，不会因为只部署了新代码而改变播放行为。

确认服务器时间已自动同步：

```bash
timedatectl show -p NTPSynchronized
```

应显示 `NTPSynchronized=yes`。

### 9.2 先让程序生成 Type D 地址

把程序开关改为开启并重启；此时 CDN 控制台尚未开启鉴权，Type D 参数不会导致播放中断：

```bash
sudo sed -i 's/^TENCENT_CDN_URL_AUTH_ENABLED=false$/TENCENT_CDN_URL_AUTH_ENABLED=true/' /opt/student-management/shared/.env
sudo pm2 restart student-management --update-env
```

登录网站播放一个课程视频，在浏览器网络请求中确认地址使用 `video.taotaomath.top`，并包含 `sign` 和 `t` 参数。不要把完整鉴权地址发送给其他人。

### 9.3 开启腾讯云 CDN 鉴权

进入：`腾讯云 CDN → 域名管理 → video.taotaomath.top → 管理 → 访问控制 → 鉴权配置`，配置：

- 配置状态：开启。
- 鉴权模式：`Type D`。
- 鉴权密钥：与服务器 `TENCENT_CDN_URL_AUTH_KEY` 完全一致。
- 时间格式：十进制 Unix 时间戳。
- 签名参数：`sign`，时间参数：`t`。
- 有效时间：`7200` 秒。
- 鉴权范围：指定文件后缀 `mp4;webm;mov;m4v`。

保存后验证：网站内正常播放和拖动进度条应成功；去掉 `sign`、`t` 参数的同一路径应返回 403；修改路径、签名或使用过期地址也应返回 403。

### 9.4 开启私有 COS 回源

CDN 鉴权验证成功后，进入：`CDN → 域名管理 → video.taotaomath.top → 管理 → 基本配置 → 源站配置`，开启“私有存储桶访问”或“回源鉴权”。先再次验证网站视频可以播放，再进入对应 COS 存储桶的权限管理，将存储桶改为“私有读写”。

最终应同时满足：

- 网站签发的 CDN 地址返回 200 或分段请求的 206。
- 不带 CDN 鉴权参数的地址返回 403。
- COS 源站的不带签名地址返回 403。
- COS 监控以少量“CDN 回源流量”为主，不再持续产生大量“外网下行流量”。

### 9.5 回滚

如果 CDN 鉴权开启后播放异常，先在腾讯云控制台关闭 CDN URL 鉴权，再执行：

```bash
sudo sed -i 's/^TENCENT_CDN_URL_AUTH_ENABLED=true$/TENCENT_CDN_URL_AUTH_ENABLED=false/' /opt/student-management/shared/.env
sudo pm2 restart student-management --update-env
```

顺序不能颠倒：如果 CDN 仍要求 Type D 鉴权，而程序已经恢复旧地址，视频会暂时返回 403。故障排除后应尽快重新启用 CDN 鉴权，避免视频地址长期缺少访问保护。
