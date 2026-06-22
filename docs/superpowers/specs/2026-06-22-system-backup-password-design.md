# 系统备份与个人密码设计

日期：2026-06-22

## 背景

当前系统使用 SQLite，生产部署约定将数据库放在 `/opt/student-management/shared/dev.db`，上传资料放在 `/opt/student-management/shared/storage/resources`。部署升级脚本已经会在升级前把数据库复制到 `/opt/student-management/backups`。

本次新增两个系统层能力：

- 服务器每天自动备份数据库，并在管理员页面显示最近备份。
- 所有登录用户可以修改自己的账号密码。

## 目标

- 每天自动备份 SQLite 数据库。
- 自动备份和手动备份共用一个备份目录。
- 只保留最近 15 次备份，旧备份自动清理。
- 管理员可以在系统设置页查看最近备份列表。
- 管理员可以手动触发一次数据库备份。
- 所有登录用户可以修改自己的密码。
- 修改密码成功后清除当前会话，要求重新登录。

## 非目标

- 第一版不做一键恢复数据库，避免误操作覆盖生产数据。
- 第一版不开放备份下载。
- 第一版不备份上传资料文件，只备份 SQLite 数据库。
- 第一版不做备份失败通知。

## 备份设计

### 服务器脚本

新增 `deploy/backup-db.sh`。

默认参数：

- `APP_ROOT=/opt/student-management`
- `DB_PATH=$APP_ROOT/shared/dev.db`
- `BACKUP_DIR=$APP_ROOT/backups`
- `KEEP_BACKUPS=15`

脚本行为：

1. 确认数据库文件存在。
2. 创建备份目录。
3. 复制数据库到 `dev-YYYYMMDD-HHMMSS.db`。
4. 按文件修改时间倒序保留最近 15 个 `dev-*.db`。
5. 删除更旧的备份。

### 自动安装

`deploy/server-init.sh` 在首次部署时安装 cron：

```text
0 3 * * * APP_ROOT=/opt/student-management KEEP_BACKUPS=15 bash /opt/student-management/current/deploy/backup-db.sh
```

默认每天凌晨 3 点备份一次。

### 升级前备份

`deploy/deploy-update.sh` 保留现有升级前备份逻辑，但也使用 15 次保留策略，避免备份无限增长。

## 管理员系统设置页

新增 `/settings` 页面。

所有登录用户都能进入该页面修改自己的密码。管理员额外看到“数据库备份”区域。

备份区域展示：

- 备份文件名
- 文件大小
- 修改时间

管理员可以点击“立即备份”。后端执行一次手动备份，并刷新备份列表。

## API 设计

### 修改密码

新增 `POST /api/account/password`。

请求字段：

- `currentPassword`
- `newPassword`
- `confirmPassword`

校验：

- 当前密码必须正确。
- 新密码至少 6 位。
- 新密码和确认密码必须一致。

成功后：

- 更新当前用户 `passwordHash`。
- 删除当前会话。
- 返回跳转到 `/login`。

### 备份列表与手动备份

新增 `GET /api/system/backups`。

- 仅管理员可访问。
- 返回最近 15 个备份文件。
- 只读取 `dev-*.db`。

新增 `POST /api/system/backups`。

- 仅管理员可访问。
- 调用共享备份逻辑创建一次备份。
- 创建后返回最新备份列表。

## 应用内备份逻辑

新增 `src/lib/database-backups.ts`，供 API 使用。

职责：

- 解析当前数据库路径。
- 定位备份目录。
- 创建数据库备份。
- 列出最近备份。
- 清理超过 15 次的旧备份。

生产环境优先使用 `APP_ROOT` 推导 `/opt/student-management/backups`。本地开发时使用项目根目录下的 `backups/`，方便调试。

## 导航

教师/管理员侧边栏增加“系统设置”入口。

家长端侧边栏增加“账号设置”入口。

普通老师和家长进入设置页时只看到修改密码。管理员会额外看到数据库备份列表和手动备份按钮。

## 测试重点

- 备份脚本包含数据库路径、备份目录、保留 15 次和 cron 安装逻辑。
- 管理员可以访问备份列表 API。
- 非管理员不能访问备份列表 API。
- 手动备份会生成 `dev-*.db`。
- 超过 15 份备份时会清理旧文件。
- 修改密码会验证当前密码。
- 修改密码成功后会清除会话并要求重新登录。
- 老师、家长、管理员都能看到设置入口。

