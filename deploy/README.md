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

完成后可以通过服务器 IP 访问：

```text
http://你的服务器IP
```

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

隐藏后台登录地址由 `/opt/student-management/shared/.env` 中的 `HIDDEN_LOGIN_PATH` 控制，默认值为 `/teacher-login-2026`。如果不需要隐藏入口，可设置为 `HIDDEN_LOGIN_PATH="/login"`。修改该变量后需要重新部署，或执行 `sudo pm2 restart student-management --update-env` 让当前服务读取新环境变量。

## 7. 常用账号提醒

如果执行过 seed，默认会生成：

- `admin / admin123`
- `teacher / teacher123`
- `parent / parent123`
- `demo / demo123`

正式上线前请登录后台修改默认密码。
