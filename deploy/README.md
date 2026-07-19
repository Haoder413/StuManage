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
REPO_URL=<REMOTE_URL> BRANCH=main APP_ROOT=/opt/student-management PORT=3001 sudo -E bash deploy/server-init.sh
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

已经部署过旧版本的服务器首次上线设备登录功能时，需要单独安装一次每日维护任务：

```bash
cd /opt/student-management/current
sudo bash deploy/install-maintenance-cron.sh
```

检查任务是否已正确写入：

```bash
cat /etc/cron.d/student-management-maintenance
```

设备历史清理日志位于 `/opt/student-management/backups/device-cleanup.log`。后续常规更新仍使用无需 `sudo` 的 `deploy-update.sh`。

## 3. 空数据库初始化

部署脚本默认会执行：

```bash
npx prisma db push
```

如果数据库文件不存在，它会创建一个新的 SQLite 空库，并同步当前表结构。

默认情况下，部署脚本不会执行 seed，因此不会清空或重建数据。

如果你希望新服务器生成默认演示账号和测试数据，可以只在首次部署后执行一次：

```bash
REPO_URL=<REMOTE_URL> RUN_SEED=1 bash /opt/student-management/current/deploy/deploy-update.sh
```

注意：有真实业务数据后，不要再使用 `RUN_SEED=1`，因为 seed 会重建数据。

## 4. 后续正常升级

本地修改代码后，先推送到 GitHub 或码云：

```bash
./deploy/publish-repo.sh <REMOTE_URL> main
```

然后在服务器执行：

```bash
REPO_URL=<REMOTE_URL> BRANCH=main bash /opt/student-management/current/deploy/deploy-update.sh
```

升级脚本会自动完成：

- 备份当前 SQLite 数据库
- 拉取最新代码到新的 release 目录
- 安装依赖
- 生成 Prisma Client
- 同步数据库结构
- 构建 Next.js 项目
- 切换当前版本
- 重启 PM2 服务

## 5. 回滚到上一个版本

如果更新后发现问题，可以执行：

```bash
bash /opt/student-management/current/deploy/rollback.sh
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
REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main bash /opt/student-management/current/deploy/deploy-update.sh
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
