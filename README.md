# 学生管理系统

这是一个面向个人教师/小型教学场景的学生管理系统，包含教师端、管理员端、家长端和演示账号能力。项目已加入账号登录、工作区隔离、家长可见学生绑定、资料权限控制和服务器部署脚本。

## 主要功能

- 学生档案管理：学生基本信息、课时、备注、家长联系方式。
- 课程与学习进度：课程内容、知识点、学生学习状态。
- 上课记录：到课情况、课堂内容、课堂反馈、标签记录。
- 成绩记录：考试/测验成绩，家长端支持曲线图查看。
- 薄弱点复习：薄弱点记录、掌握状态、复习安排。
- 资料中心：老师上传试卷或动画，管理员控制家长和演示账号的预览/下载权限。
- 账号管理：管理员可创建老师、家长、演示账号，并绑定家长可查看的学生。
- 演示数据：支持独立演示工作区，便于展示完整功能。

## 角色说明

- 管理员：可使用教师端全部功能，并额外管理账号、密码、家长学生绑定和资料权限。
- 老师：使用主要教学管理功能，管理真实业务数据。
- 家长：只进入家长端，查看被授权学生的上课记录、成绩曲线、学习进度和资料中心。
- 演示账号：用于展示功能，数据与真实工作区隔离，权限也可由管理员控制。

## 技术栈

- Next.js 14
- React 18
- Prisma 5
- SQLite
- Tailwind CSS
- Recharts
- PM2 + Nginx 部署

## 本地启动

首次安装依赖：

```bash
npm install
```

同步数据库结构：

```bash
npx prisma db push
```

如需生成默认账号和演示数据：

```bash
npm run db:seed
```

启动开发服务：

```bash
npm run dev
```

也可以使用项目中的一键脚本：

```bash
./start.sh
```

停止本地服务：

```bash
./stop.sh
```

默认访问地址通常是：

```text
http://localhost:3000
```

## 默认账号

执行 seed 后会生成以下账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 老师 | teacher | teacher123 |
| 家长 | parent | parent123 |
| 演示 | demo | demo123 |

正式上线前请先修改默认密码。

## 服务器部署

推荐服务器系统：Ubuntu 22.04 LTS。

部署脚本在 `deploy/` 目录中，详细说明见：

```text
deploy/README.md
```

首次部署大致流程：

```bash
REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main APP_ROOT=/opt/student-management PORT=3001 sudo -E bash deploy/server-init.sh
```

现有服务器首次上线设备登录功能时，还需安装每日设备历史清理任务并检查 cron：

```bash
cd /opt/student-management/current
sudo bash deploy/install-maintenance-cron.sh
cat /etc/cron.d/student-management-maintenance
```

后续更新代码后，在服务器执行：

```bash
REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main bash /opt/student-management/current/deploy/deploy-update.sh
```

### 设备登录功能首次上线

更新脚本会在同步数据库结构后自动执行 `npm run devices:migrate`。迁移标记为 `device-session-v1`：

- 首次执行会让全部账号退出一次，用户需重新登录，不会修改密码、资料或课程数据。
- 成功写入标记后，后续部署不会再让用户退出。
- 迁移的“删除旧会话”和“写入标记”在同一个数据库事务中，失败时会整体回滚。

已有服务器如果需要手动执行，请先确认当前 release 的 `.env` 仍链接到共享环境文件，然后连续执行两次：

```bash
cd /opt/student-management/current
readlink -f .env
npm run devices:migrate
npm run devices:migrate
```

第二次应输出 `{"clearedSessions":0,"alreadyApplied":true}`。

如果遇到 `EACCES ... node_modules/.prisma/client`，表示当前 release 的依赖目录不属于实际运行服务的用户。下面以 PM2 由 `ubuntu` 用户运行为例；如果服务由其他用户运行，必须把 `APP_USER` 改成该用户：

```bash
APP_USER=ubuntu
APP_GROUP="$(id -gn "$APP_USER")"
CURRENT_RELEASE="$(readlink -f /opt/student-management/current)"
sudo chown -R "$APP_USER:$APP_GROUP" "$CURRENT_RELEASE/node_modules"
sudo -u "$APP_USER" bash -lc "cd '$CURRENT_RELEASE' && npx prisma generate"
```

如果遇到 `attempt to write a readonly database`，需要同时修正 SQLite 数据库文件和共享目录的写权限（SQLite 会在目录内创建 journal/WAL 文件）：

```bash
APP_USER=ubuntu
APP_GROUP="$(id -gn "$APP_USER")"
sudo chown "$APP_USER:$APP_GROUP" /opt/student-management/shared
sudo chmod u+rwx /opt/student-management/shared
sudo find /opt/student-management/shared -maxdepth 1 -type f \
  \( -name 'dev.db' -o -name 'dev.db-wal' -o -name 'dev.db-shm' \) \
  -exec chown "$APP_USER:$APP_GROUP" {} +
sudo chmod u+rw /opt/student-management/shared/dev.db
sudo -u "$APP_USER" bash -lc 'cd /opt/student-management/current && npm run devices:migrate'
```

不要使用 `chmod 777`，也不要把数据库复制进 release 目录。应让实际运行 PM2 服务的用户拥有 `/opt/student-management/shared/dev.db` 及其目录写权限。

如果更新后需要回滚：

```bash
bash /opt/student-management/current/deploy/rollback.sh
```

## 登录入口与关闭登录

生产环境的登录入口由服务器环境变量控制，配置文件位置是：

```bash
sudo nano /opt/student-management/shared/.env
```

默认隐藏登录地址：

```env
HIDDEN_LOGIN_PATH="/teacher-login-2026"
LOGIN_ENABLED="true"
```

如果希望使用普通登录地址 `/login`：

```env
HIDDEN_LOGIN_PATH="/login"
LOGIN_ENABLED="true"
```

如果审核期间只展示公开首页，不开放登录页和登录接口：

```env
LOGIN_ENABLED="false"
```

修改 `.env` 后，执行：

```bash
sudo pm2 restart student-management --update-env
```

如果服务器还没有部署包含 `LOGIN_ENABLED` 的最新代码，先执行完整更新：

```bash
REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main bash /opt/student-management/current/deploy/deploy-update.sh
```

注意：

- `.env` 不会推送到远端仓库，也不会被部署脚本覆盖；需要在服务器 `/opt/student-management/shared/.env` 手动修改。
- `HIDDEN_LOGIN_PATH` 只负责修改登录路径，不负责关闭登录。删除或留空 `HIDDEN_LOGIN_PATH` 会回到默认隐藏地址 `/teacher-login-2026`。
- 首次新增登录开关代码后需要重新部署一次；之后只切换 `LOGIN_ENABLED` 或 `HIDDEN_LOGIN_PATH` 时，一般重启 PM2 即可。如果重启后仍不生效，再执行一次完整更新。

## 数据与文件说明

以下内容属于本地或服务器运行数据，不上传到代码仓库：

- `.env`
- `prisma/*.db`
- `storage/`
- `.next/`
- `node_modules/`
- `docs/`

生产环境中，SQLite 数据库和上传文件会放在 `/opt/student-management/shared`，升级代码时不会覆盖真实数据。

## 资料中心 AI 配置与迁移

新版资料中心以“一套资料”为单位管理学生版、答案版和补充文件，支持批量上传、服务端分页搜索以及 DeepSeek 文件名整理。AI 只接收原文件名，不读取 PDF、Word 或 HTML 正文。

### 1. 登录服务器并确认目录

通过 SSH 登录服务器后执行：

```bash
cd /opt/student-management/current
pwd
ls -l /opt/student-management/shared/.env
```

正常情况下会看到当前目录为 `/opt/student-management/current`，共享环境文件位于：

```text
/opt/student-management/shared/.env
```

这个文件保存在共享目录中，不会被后续版本发布覆盖，也不会上传到 Git。

### 2. 备份现有环境文件

修改前先创建一份带时间的备份：

```bash
sudo cp -a /opt/student-management/shared/.env \
  "/opt/student-management/shared/.env.backup-$(date +%Y%m%d-%H%M%S)"
```

查看备份是否生成：

```bash
sudo ls -lt /opt/student-management/shared/.env.backup-* | head
```

### 3. 编辑 DeepSeek 和上传限制

使用服务器编辑器打开共享环境文件：

```bash
sudo nano /opt/student-management/shared/.env
```

保留文件中原有的 `DATABASE_URL`、`NODE_ENV`、`PORT`、登录开关等配置，在文件末尾新增下面内容：

```env
DEEPSEEK_API_KEY="sk-替换成你在 DeepSeek 控制台创建的真实密钥"
DEEPSEEK_MODEL="deepseek-chat"

# 以下三项可以不写；如需配置，只能低于或等于程序默认上限
RESOURCE_MAX_FILE_BYTES="104857600"
RESOURCE_MAX_BATCH_FILES="50"
RESOURCE_MAX_BATCH_BYTES="524288000"
```

`nano` 保存方法：

1. 按 `Ctrl + O`。
2. 按回车确认文件名。
3. 按 `Ctrl + X` 退出。

注意：

- 同一个变量只保留一行，不要重复添加多个 `DEEPSEEK_API_KEY`。
- 不要把真实密钥发到聊天、截图或提交到 Git。
- `104857600` 表示单文件 100 MB，`524288000` 表示单批次 500 MB。
- 未配置 `DEEPSEEK_API_KEY` 时，上传仍然可用，系统会使用本地文件名规则并允许老师手动整理。

### 4. 安全检查配置

下面的命令只显示变量名及非密钥配置，不会输出真实 API Key：

```bash
sudo sh -c '
  if grep -q "^DEEPSEEK_API_KEY=\"[^\"]\+\"" /opt/student-management/shared/.env; then
    echo "DEEPSEEK_API_KEY：已配置"
  else
    echo "DEEPSEEK_API_KEY：未配置或格式不正确"
  fi
  grep -E "^(DEEPSEEK_MODEL|RESOURCE_MAX_FILE_BYTES|RESOURCE_MAX_BATCH_FILES|RESOURCE_MAX_BATCH_BYTES)=" \
    /opt/student-management/shared/.env || true
'
```

建议限制环境文件访问权限：

```bash
sudo chmod 600 /opt/student-management/shared/.env
```

确认当前版本的 `.env` 软链接指向共享文件：

```bash
readlink -f /opt/student-management/current/.env
```

输出应为：

```text
/opt/student-management/shared/.env
```

### 5. 部署包含新版资料中心的代码

如果服务器尚未部署新版资料中心，执行：

```bash
REPO_URL=git@github.com:Haoder413/StuManage.git \
BRANCH=main \
bash /opt/student-management/current/deploy/deploy-update.sh
```

部署脚本会自动备份 SQLite 数据库、安装依赖、同步数据库结构、构建项目并重启 PM2。代码尚未推送到远程仓库时，不要执行这一步，先确保服务器使用的分支已经包含新版资料中心提交。

### 6. 备份资料并执行迁移

即使部署脚本已经自动备份数据库，在首次迁移资料中心前仍建议再手动备份一次：

```bash
cd /opt/student-management/current
sudo bash deploy/backup-db.sh
```

如果服务器中已有大量上传资料，还可以额外备份资料文件目录：

```bash
sudo tar -czf "/opt/student-management/backups/resources-$(date +%Y%m%d-%H%M%S).tar.gz" \
  -C /opt/student-management/shared storage/resources
```

同步资料中心数据库结构：

```bash
cd /opt/student-management/current
npx prisma db push --accept-data-loss
```

这里的 `--accept-data-loss` 用于确认新增“每套资料只能有一个学生版和一个答案版”的唯一索引。执行前必须保留数据库备份；本次资料中心升级脚本不会主动删除现有资料。

然后执行旧资料迁移：

```bash
cd /opt/student-management/current
npm run resources:migrate
```

迁移成功后会输出旧资料数、新建资料组数、新建文件数、复制权限数和 `backfilledYears`。其中 `backfilledYears` 表示从历史资料标题或文件名中自动补齐年份的数量；原本已有年份的数据不会被覆盖。建议再执行一次：

```bash
npm run resources:migrate
```

第二次执行时，`createdGroups`、`createdFiles` 和 `backfilledYears` 应为 `0`，表示迁移具有幂等性，没有重复创建资料或反复修改年份。

每条旧资料会建立一个独立资料组，并复制一份独立存储文件，避免新旧入口互相影响；无法判断学生版或答案版的旧文件会标记为“信息待完善”。永久迁移标记会阻止已删除的新版资料组被再次创建。

### 7. 重启并检查服务

让 PM2 重新读取共享环境变量：

```bash
sudo pm2 restart student-management --update-env
sudo pm2 status
```

查看最近日志，确认没有数据库或环境变量错误：

```bash
sudo pm2 logs student-management --lines 80 --nostream
```

最后登录教师端，进入“资料中心”，选择几个测试文件。AI 正常时页面会提示 DeepSeek 已根据文件名完成整理；如果显示本地规则整理，请重点检查 API Key、服务器外网连接和 PM2 日志。

### 8. 修改或撤销配置

更换 DeepSeek 密钥后，只需重新编辑共享环境文件并重启：

```bash
sudo nano /opt/student-management/shared/.env
sudo pm2 restart student-management --update-env
```

如果要临时关闭 AI，可删除或注释 `DEEPSEEK_API_KEY`，然后重启 PM2。批量上传不会被关闭，只会自动切换到本地文件名规则。

如果环境文件修改错误，可查看备份并恢复指定版本：

```bash
sudo ls -lt /opt/student-management/shared/.env.backup-*
sudo cp -a /opt/student-management/shared/.env.backup-YYYYMMDD-HHMMSS \
  /opt/student-management/shared/.env
sudo pm2 restart student-management --update-env
```

## 常用命令

```bash
npm run dev        # 本地开发
npm run build      # 生产构建
npm run start      # 启动生产服务
npm run db:push    # 同步数据库结构
npm run db:seed    # 生成默认账号和演示数据
npm run db:studio  # 打开 Prisma Studio
```

## 项目备注

当前仓库不包含真实数据库、上传文件和本地开发文档。服务器首次部署时可以创建空数据库；如果需要演示数据，再手动执行 seed。
