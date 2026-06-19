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

后续更新代码后，在服务器执行：

```bash
REPO_URL=git@github.com:Haoder413/StuManage.git BRANCH=main bash /opt/student-management/current/deploy/deploy-update.sh
```

如果更新后需要回滚：

```bash
bash /opt/student-management/current/deploy/rollback.sh
```

## 数据与文件说明

以下内容属于本地或服务器运行数据，不上传到代码仓库：

- `.env`
- `prisma/*.db`
- `storage/`
- `.next/`
- `node_modules/`
- `docs/`

生产环境中，SQLite 数据库和上传文件会放在 `/opt/student-management/shared`，升级代码时不会覆盖真实数据。

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
