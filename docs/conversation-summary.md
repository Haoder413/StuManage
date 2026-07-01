# 对话共享摘要

更新时间：2026-06-30 00:00 CST

## 项目概况

这是一个学生管理小项目，主要技术栈是 Next.js 14、React、Prisma、SQLite。核心模块包括学生管理、课程管理、排课考勤、学习进度、薄弱点复习、考试记录和沟通记录。

本轮协作的原则是：优先节省 token，只读取与问题直接相关的代码，不全量扫描项目。

## 文档状态

截至 2026-06-26，前述后续计划均已完成。`docs/superpowers/plans/` 中的文件保留为已完成实施计划归档，用于追溯当时的设计、任务拆分和验证口径，不代表当前还有未完成待办。

## 当前权限约定

- 账号角色以服务端 session 关联的 `User.role` 为唯一可信来源。
- 不再使用单独的 `student_management_role` cookie 判断后台菜单、账号与学习关系入口或页面跳转，避免角色 cookie 与 session 不一致时把 admin 误判为其他角色。
- `/accounts` “账号与学习关系”页面仍只允许 `admin` 访问；侧边栏是否显示该入口由服务端传入的当前用户角色和 `/api/account/me` 返回的 session 用户角色决定。

## 已处理的问题与功能

### 家长端视频回放

2026-06-30 用户希望增加“上课录制视频上传后，家长端可看回放”的功能，已按“嵌入现有页面”的方向实现。

当前规则：

- 视频回放挂在具体出勤或补课记录上。
- 老师在排课考勤的课后反馈弹窗中上传、替换或删除课堂视频。
- 家长端可以在“时间管理”的老师课程详情中看到“课堂回放”区域。
- 权限应沿用学习关系：家长只能看自己启用学习关系下孩子、老师、科目、课程对应的课堂视频。
- 视频文件保存到 `storage/lesson-videos/`，数据库只保存文件名、存储名、大小、类型、课堂关联和上传人等元数据。
- 当前不做独立“回放库”，未来视频多了以后再增加按孩子、课程和日期筛选的入口。
- 后续已扩展为可切换存储适配层：`local`、`vod`、`cos`。当前可以通过 `LESSON_VIDEO_STORAGE_PROVIDER=vod` 切到腾讯云云点播，后期切 COS + CDN 时复用同一课堂视频模型和播放接口。
- 2026-06-30 线上上传视频出现 `413 Request Entity Too Large`，判断为 Nginx 上传大小限制；部署模板改为允许 2048MB，并增加 1800 秒上传/代理超时，现有服务器需要同步 reload Nginx。
- 2026-06-30 进一步排查视频上传仍报“服务器上传上限不足”：发现应用层还有固定 500MB 上限，已调整为默认 2048MB，并支持 `LESSON_VIDEO_MAX_MB` 环境变量配置。后续如果仍报 413，需要区分是 Nginx 返回的 413，还是应用返回的 `lesson_video_too_large`。
- 2026-06-30 排课考勤交互调整：已记录考勤后卡片不再常驻显示“出勤/请假/补课”三枚按钮，而是显示“已记录：状态”和“修改”；点击“修改”后才允许重新选择状态或替换视频，减少误触重复上传。
- 2026-07-01 用户希望上传课堂视频时能看到进度。教师端课后反馈弹窗改为使用支持上传进度的请求方式，并显示“正在上传 xx%”进度条；上传期间禁用取消、保存和文件选择，避免重复提交。
- 2026-07-01 用户反馈 VOD 上传很慢且失败，网络面板响应 `{"error":"i is not a function"}`。判断失败发生在服务器调用腾讯云 VOD SDK 阶段；当前链路“浏览器 -> 服务器 -> VOD”对老师上行网络不友好。建议下一步设计“从 URL 导入/VOD PullUpload”方案，可让腾讯云从 NAS 公网临时链接拉取视频，同时网站继续绑定课堂、学生、考勤和家长权限。
- 2026-07-01 用户补充 PM2 日志，确认错误为 `Lesson video upload failed` / `i is not a function`，堆栈位于 `.next/server/chunks/... doRequest`。判断当前腾讯云 VOD/COS Node SDK 被 Next.js 生产构建打包后运行异常，已将相关 SDK 配置为服务端外部依赖，重新部署后需要再次验证上传。
- 2026-07-01 重新部署后，VOD 上传错误变为腾讯云返回的 `The SecretId is not found, please ensure that your SecretId is correct.`。说明 SDK 打包问题已跨过，当前是服务器环境变量里的腾讯云 API 密钥无效、填错、被禁用，或不属于当前账号/子应用；需要在腾讯云 CAM/API 密钥管理中核对或新建密钥，并只配置到服务器 `.env`。
- 2026-07-01 用户确认域名备案已通过。后续正式访问入口应从 IP 切回 `taotaomath.top` / `www.taotaomath.top`，Nginx 以域名站点配置 `/etc/nginx/sites-available/student-management` 为主；`student-management-ip` 仅作临时兜底或关闭。
- 2026-07-01 公安联网备案表单服务类型确认：网站有登录、上传课堂视频、家长端查看等交互功能，“是否提供互联网交互服务”按实际选择“是”；网站类型不选“网络基础类 A”，应优先选“生活服务类 C”下的教育相关类别。
- 2026-07-01 用户准备从 VOD 切换到 COS + CDN。`video.taotaomath.top` 将作为视频/CDN 专用域名规划启用，主站继续用 `taotaomath.top` / `www.taotaomath.top`；视频域名应只用于课堂视频静态资源分发，网站后端继续负责家长权限和短期播放地址生成。
- 2026-07-01 进一步确认视频测试和切换路径：为了审核，公开首页和登录隐藏设计保持不变；视频上传可在本地用默认 `local` 存储测试业务流程，但 COS + CDN 必须在线上联调。当前代码的 `cos` 分支只是预留，不能只改环境变量切换，需先实现 COS 适配器，再配置 `video.taotaomath.top`、COS Bucket、CDN CNAME、HTTPS 和防盗链/签名 URL。
- 2026-07-01 公开首页调整：根路径 `/` 改为公开首页，不再直接跳转登录；首页只显示“资料中心”菜单和免责声明，菜单进入公开资料中心 `/materials`，不会跳转登录。原后台仪表盘迁移到 `/dashboard`，老师、管理员和演示账号登录后进入 `/dashboard`。
- 2026-07-01 讨论腾讯会议回放链接拉取：普通腾讯会议播放页/分享页不是直接视频文件 URL，通常不能直接给 VOD 拉取；可实现的版本是“从可公网访问的视频直链导入”，包括 NAS 临时直链、对象存储直链，或后续通过腾讯会议开放接口获取云录制下载地址。

- 2026-07-01 公开首页二次调整：按备案口径更新免责声明，首页不再显示“资料中心”按钮，改为顶部免责声明、下方直接展示公开资料卡片。公开资料从独立服务器目录 `/opt/student-management/shared/storage/public-materials` 读取，管理员可直接在服务器上传文件；该目录不开放网页上传。
- 2026-07-01 登录入口隐藏：旧地址 `/login` 默认不显示登录表单，未登录访问后台会回到公开首页；后台登录地址改为由服务器环境变量 `HIDDEN_LOGIN_PATH` 控制，默认值为 `/teacher-login-2026`。如果不需要隐藏入口，可把该变量设为 `/login`。登录页账号输入框移除示例账号占位文字，并删除“查看网站免责声明”按钮。
- 2026-07-01 公开首页底部悬挂 ICP 备案号 `辽ICP备2026013992号`，链接到 `https://beian.miit.gov.cn/`。

2026-06-30 进一步讨论课堂视频存储方案：

- 推荐优先使用轻量 NAS 做视频源，但不要把 NAS 原始地址直接暴露给家长。
- 较稳妥方案是网站继续保留权限校验，视频文件放在 NAS 挂载目录或由网站后端代理读取；家长仍通过系统里的课堂回放入口播放。
- 不推荐把夸克网盘等个人网盘作为课堂回放主存储，因为分享链接可能过期、需要登录、外链播放稳定性和访问权限不适合纳入系统权限体系。
- 不推荐只提供下载链接作为第一版主方案，因为家长下载后更容易外传，也会脱离系统里的学习关系权限控制。
- 如果短期磁盘压力不大，可以先继续使用服务器本地 `storage/lesson-videos/`；当视频变多后，再把该目录迁移到 NAS 挂载路径。

### 排课考勤

- 修复了编辑排课后点击日期报错的问题。
  - 根因：保存排课接口返回的对象缺少 `student` 和 `attendance`，前端渲染详情时访问不到。
  - 处理：`src/app/api/schedules/route.ts` 的新增和编辑接口返回完整排课对象。

- 修复了固定排课改成灵活排课后，原日期上学生数据消失的问题。
  - 根因：固定排课没有单次日期，编辑时日期默认成“今天”，保存为灵活排课后被移动到了今天。
  - 处理：编辑固定排课转灵活排课时，默认日期改为当前选中的日历日期；固定排课只保存星期，灵活排课只保存日期。

- 增加课堂回顾与标签。
  - 点击 `出勤` 或 `补课` 时会打开课堂反馈弹窗，可填写上课内容、上课反馈，并用 chips 选择或新增标签。
  - 弹窗新增 `薄弱点` 输入区，样式与 `上课内容`、`上课反馈` 一致；下方直接显示 `/api/weak-point-tags` 的标签 chips，可在排课弹框中新增标签。
  - 薄弱点标签和学习进度页共用同一张 `WeakPointTag` 表、同一个 `/api/weak-point-tags` 接口；薄弱点标签支持多选，保存时会为每个选中标签创建该学生的薄弱点和第 1 次复习计划。输入框里额外手写的内容也会一起保存，并做去重。
  - `上课内容`、`上课反馈`、`薄弱点` 三块交互已统一为 `新增标签` 按钮 + 搜索标签框 + 标签 chips。已删除每块上方的大文本输入框；搜索框只用于筛选标签。三块标签都支持多选、重命名和删除，新增标签按钮固定在最前面。
  - `请假` 仍保持快速标记。
  - 标签分为 `content` 和 `feedback` 两类，通过 `/api/lesson-tags` 增删改查。
  - 考勤接口会按同一天同一排课更新已有记录，避免重复插入。
  - 修复课堂反馈弹框内容过长时无法上下滑的问题：弹框限制为 `90vh`，内容内部滚动，底部操作按钮固定在弹框底部。

### 学生管理

- 学生管理首页已从表格列表改为卡片网格，和学习进度等页面风格保持一致：
  - 大屏每行 3 个学生卡片。
  - 卡片显示姓名、年级、所属课程、上课频次、入学日期、家长联系方式。
  - 点击整张卡片进入学生详情。
- 学生详情页增加了返回按钮。
- 学生详情页增加了“历史上课内容回顾”，按日期倒序展示出勤/补课记录、上课内容、上课反馈和标签 chips。
- 学生详情页返回按钮已移到页面左上角；历史上课内容回顾不再显示“未填写”，只展示已有标签。
- 学生详情页历史回顾已统一上课内容、上课反馈、薄弱点三列的标签样式；排课保存时会把薄弱点标签快照写入 `Attendance.weakPointTags`，因此学生详情可以展示本次课程关联的薄弱点。
- 学生详情页的基本信息和最近沟通记录已支持编辑：
  - 基本信息卡片可编辑姓名、年级、家长联系方式、入学日期、上课频次、学费、总课时、剩余课时、备注。
  - 最近沟通记录每条可编辑沟通方式、日期、内容。
  - `/api/students` 和 `/api/communication` 已增加 `PATCH`。
- 学生详情页顶部统计已调整：
  - 原 `课程数` 改为 `所属课程`，直接显示该学生关联课程名称。
  - 原 `考试次数` 改为 `课时统计`，格式为 `剩余课程/总课时`。
  - `总课时` 存在 `Student.totalLessonHours`，`剩余课时` 存在 `Student.remainingLessonHours`，两者都可在学生详情的基本信息编辑弹框里修改。
  - 在排课考勤页点击 `出勤` 保存后，学生详情的剩余课时会减少 1；如果同一条考勤已经是出勤，重复保存不会重复扣课时。`补课` 暂不计入课时消耗。
- 新增学生页已简化为学生档案信息录入，不再选择课程，也不再在建档时同步创建学生-课程关联或固定排课。
- 学生建档后的课程归属通过课程管理、账号与学习关系或学生详情相关流程维护。

### 课程管理

- 课程管理首页已从表格列表改为卡片网格：
  - 大屏每行 3 个课程卡片。
  - 卡片显示课程名称、课程类型、课程说明、知识点数、选课学生数。
  - 点击整张卡片进入课程详情。
- 课程详情页增加返回按钮。
- 课程详情页显示 `选课学生` 卡片，列出属于该课程的学生，并可点击进入学生详情。
- 新建/编辑课程时，课程时间支持：
  - 每组课程时间多选周一到周日，也可一键选择工作日。
  - 设置开始日期和截止日期；不填日期时按长期固定课处理。
  - 保存后按所选星期拆成对应固定排课，并把日期范围同步到排课。
  - 排课考勤日历展示固定课程时会按开始日期和截止日期过滤，避免生成或展示过大的、不合理的日期范围。
- 修改课程时间时保留已有考勤的旧排课：
  - 没有任何考勤记录的旧排课会删除，并按新的课程时间重新生成。
  - 已有考勤记录的旧排课不会删除；如果仍匹配新的课程时间则继续作为当前有效排课，否则标记为历史排课。
  - 家长端和小程序只在对应考勤日期展示历史排课，避免历史课堂丢失，也避免无效旧时间继续污染未来课程安排。
- 知识点大纲支持修改：
  - 已删除根级 `新增知识点` 按钮，主要通过批量导入新增根知识点。
  - 每个知识点可新增子知识点、重命名、删除。
  - 支持批量导入：课程详情页可点击 `批量导入`，粘贴按缩进或短横线组织的树状大纲，系统会追加创建对应父子知识点。
  - 批量格式示例：
    ```text
    有理数
      正负数与数轴
      绝对值与相反数
    - 整式的加减
      - 单项式与多项式
    ```
  - 新增 `/api/knowledge-points`，支持 `POST`、`PATCH`、`DELETE`。

### 账号与学习关系

- 账号编辑支持删除账号：
  - 当前登录账号不能删除。
  - 删除家长或老师账号时，会清理其家长可见学生关系和学习关系。
  - 如果账号已经关联资料、视频、作业等历史业务记录，接口会阻止删除，避免破坏历史数据。
- 学习关系的作用已明确：它不是登录账号本身，而是家长端和小程序按“家长-学生-老师-科目/课程”隔离成绩提交、课堂记录、学习进度、资料权限和日历数据的业务绑定。
- 学习关系下拉框会联动过滤：
  - 选择家长后，学生下拉框只显示该家长账号已勾选的可见学生。
  - 选择学生后，课程下拉框只显示该学生当前关联的课程。
  - 接口也会校验家长是否可见该学生、学生是否在所选课程中，防止绕过页面提交异常关系。

### 成绩管理

- 成绩管理首页卡片布局已和学习进度保持一致，大屏每行 3 个学生成绩卡片。
- 修复新增学生后成绩管理没有该学生卡片的问题。
  - 根因：成绩管理页原来只读取 `/api/exams?groupBy=student`，再从考试记录反推学生列表；没有成绩的新学生不会出现在分组里。
  - 处理：成绩管理页现在同时读取 `/api/students` 和 `/api/exams?groupBy=student`，以全量学生列表为基准合并考试数据。没有成绩的学生也会显示卡片，统计项显示为 0 次 / `-`。
- 历史成绩明细支持编辑考试名称、考试类型、得分和满分；`/api/exams` 的 `PATCH` 会保存名称、类型和分数。
- 老师录入新成绩时，点击“保存成绩”会先弹出和家长成绩审核通过一致的薄弱点选择框，可搜索或新增薄弱点标签；确认后成绩保存，并按所选薄弱点创建薄弱点和复习计划。
- 顶部“新建考试”批量录入时也使用同一套薄弱点弹窗，所选薄弱点应用到本次所有已填写分数的学生。
- 成绩录入和成绩审核共用同一套薄弱点复用逻辑：同一个学生、同一学习关系、同一薄弱点描述，如果已有当前薄弱或巩固中的记录就复用；已有待复习计划时不重复生成；如果旧记录已全部完成，则新建一条新的薄弱点并从第 1 次复习开始。

### 薄弱点与复习

最初的“薄弱点 / 复习计划 / 历史薄弱点”流程较复杂，后续已合并为一个统一入口。

当前设计：

- 学习进度详情页保留两个主入口：
  - `知识点进度`
  - `薄弱点复习`
- `薄弱点复习` 内部有筛选：
  - 全部
  - 待复习
  - 当前薄弱
  - 巩固中
  - 已完成
- 每条薄弱点记录直接显示：
  - 描述
  - 当前状态
  - 下次复习时间
  - 是否逾期
  - 已复习次数
  - 最近复习时间
- 每条记录右侧直接提供操作：
  - 当前薄弱：`记住了`、`忘了`、`已掌握`
  - 巩固中：`记住了`、`忘了`
  - 已完成：只展示历史记录

当前流程：

1. 添加薄弱点。
2. 自动生成第 1 次复习计划。
3. 到复习时间后，在 `薄弱点复习` 中操作。
4. 点 `记住了`：完成当前阶段，生成下一阶段复习。
5. 点 `忘了`：当前阶段重置，加强复习。
6. 点 `已掌握`：从当前薄弱移入巩固/历史状态，同时继续生成后续复习计划。
7. 所有阶段完成后，记录进入已完成，只保留历史。

## 测试数据

已清空数据库并重新生成测试数据。由于 `npm run db:seed` 在当前沙盒中会因 `tsx` 临时管道权限失败，实际使用的是：

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

当前测试数据规模：

- 学生：10 个
- 课程：4 门
- 学生选课关联：14 条
- 固定排课：17 条
- 考勤记录：25 条
- 考试记录：28 条
- 薄弱点：18 条
- 当前薄弱点：9 条
- 历史薄弱点：9 条
- 复习计划：9 条
- 沟通记录：15 条

## 时间相关测试建议

复习计划依赖数据库里的 `ReviewSchedule.nextReviewAt`，不需要修改系统时间。

推荐测试方式：

```bash
npm run db:studio
```

然后在 Prisma Studio 中修改 `ReviewSchedule.nextReviewAt`，把它改成过去日期即可测试“已逾期”状态。

## 回归检查脚本

本轮新增了几个轻量检查脚本，放在 `scripts/` 下：

- `scripts/check-schedule-api-shape.mjs`
- `scripts/check-schedule-edit-date.mjs`
- `scripts/check-student-detail-back-button.mjs`
- `scripts/check-weak-point-mastered.mjs`
- `scripts/check-student-course-schedule-link.mjs`
- `scripts/check-lesson-review-schema.mjs`
- `scripts/check-lesson-review-routes.mjs`
- `scripts/check-lesson-review-weak-point-link.mjs`
- `scripts/check-lesson-review-dialog-scroll.mjs`
- `scripts/check-student-detail-editable.mjs`
- `scripts/check-course-outline-editable.mjs`
- `scripts/check-exams-includes-all-students.mjs`
- `scripts/check-student-lesson-hours.mjs`
- `scripts/check-management-card-layouts.mjs`

常用检查命令：

```bash
node scripts/check-weak-point-mastered.mjs
node scripts/check-student-detail-back-button.mjs
node scripts/check-schedule-api-shape.mjs
node scripts/check-schedule-edit-date.mjs
node scripts/check-student-course-schedule-link.mjs
node scripts/check-lesson-review-schema.mjs
node scripts/check-lesson-review-routes.mjs
node scripts/check-lesson-review-weak-point-link.mjs
node scripts/check-lesson-review-dialog-scroll.mjs
node scripts/check-student-lesson-hours.mjs
node scripts/check-management-card-layouts.mjs
npm run build
```

构建时会出现一个旧警告：

```text
npm warn Unknown user config "sass_binary_site".
```

目前判断和本轮功能无关。

## 重要文件

- `src/app/progress/students/[id]/page.tsx`
  - 学习进度详情页。
  - 当前包含统一的 `薄弱点复习` 流程。

- `src/app/api/weak-points/route.ts`
  - 薄弱点新增、查询、掌握、复习流转逻辑。

- `src/app/api/schedules/route.ts`
  - 排课新增、编辑、删除和查询。

- `src/app/schedule/page.tsx`
  - 排课考勤日历页面。
  - 出勤/补课课堂反馈弹窗和课堂标签 chips。

- `src/app/api/attendance/route.ts`
  - 考勤创建/更新，保存课堂内容、课堂反馈和标签快照。

- `src/app/api/lesson-tags/route.ts`
  - 课堂回顾标签增删改查。

- `src/app/students/new/page.tsx`
  - 新增学生表单，包含课程选择和固定排课时间。

- `src/app/api/students/route.ts`
  - 学生新增/编辑接口，负责同步创建学生课程关联和固定排课，并保存可编辑的总课时。

## 后续协作注意点

- 若继续修 bug，优先只读取相关页面和接口，避免全量读取。
- 薄弱点复习现在是统一入口，不再按“薄弱点 / 复习计划 / 历史薄弱点”三个页面理解。
- 如果要测试逾期，不改系统时间，直接改数据库里的 `nextReviewAt`。
- 如果要重新生成数据，优先使用 `ts-node` 命令运行 seed。

## 2026-06-27 学生年级自动升年级与角色来源收敛

当前未提交改动确认了两类规则：

- 后台不再使用单独的 `student_management_role` cookie 判断角色或菜单入口；角色继续以服务端 session 里的 `User.role` 为准，侧边栏通过 `/api/account/me` 获取当前会话用户角色。
- 学生年级改为固定选项：`初一`、`初二`、`初三`。每个工作区通过 `Workspace.gradeRolloverYear` 记录最近一次升年级年份；每年 9 月 1 日后访问学生列表、学生详情或学生接口时，会自动执行一次工作区内升年级：初一升初二，初二升初三，初三标记为“当年初中已毕业”（例如 `2026初中已毕业`）。

## 2026-06-18 新需求：账号登录与权限管理

用户提出希望增加账号登录和权限管理系统，并要求先评估难度。

已确认的当前状态：

- 项目仍是单人教师场景起步，技术栈为 Next.js 14、React、Prisma、SQLite。
- 当前没有用户、角色、权限、会话、教师/机构归属等数据模型。
- `src/app/layout.tsx` 直接渲染侧边栏和主内容区，没有登录页或全局登录态保护。
- 所有 `/api/*` 接口当前直接读写业务表，没有统一鉴权中间件或当前用户校验。
- 部分页面直接在 Server Component 中通过 Prisma 读取数据库，例如仪表盘、学生列表、课程列表、学生详情、报表页等；因此权限改造不能只保护 API，还要保护服务端页面读取。
- 早期设计文档已把“多教师支持：添加教师表和权限校验，适配多教师场景”列为未来扩展。

初步判断：

- 如果只做单管理员登录，难度较低，主要是增加登录页、账号表、密码哈希、会话 cookie，以及全站访问保护。
- 如果做角色权限，例如管理员、教师、助教、只读账号，难度中等，需要新增角色模型、权限判断工具，并在页面和 API 上限制新增、编辑、删除等操作。
- 如果做多教师/多机构数据隔离，难度较高，需要给学生、课程、排课、考勤、考试、薄弱点、标签等核心表补充归属字段，并改造所有查询和写入逻辑，避免跨账号看到或修改数据。

建议下一步先确认权限目标：只需要“防止外人访问”，还是需要“不同内部账号能看到和操作不同内容”。

用户随后明确：目标不是通用多教师/多机构系统，而是“一个老师 + 多个家长”两个角色的权限控制。

更新后的理解：

- 老师是系统管理者，可以维护学生、课程、排课、成绩、薄弱点、课堂回顾、沟通记录等全部数据。
- 家长是受限账号，通常只能查看自己孩子相关的信息。
- 重点不再是多老师之间的数据隔离，而是“家长账号与学生绑定”以及“家长只读/有限操作”的边界设计。
- 该需求比多机构权限简单，但比单管理员登录复杂，因为每个面向家长开放的页面和接口都必须按绑定学生过滤数据。

用户进一步明确：

- 家长端不复用当前后台功能，当前后台功能全部不直接开放给家长。
- 家长端会单独设计少量功能，数据来源仍然使用当前数据库中的学生、课程、排课、成绩、课堂回顾、薄弱点等业务数据。
- 还希望新增一个“功能演示账号”，该账号可以显示所有功能，但使用单独制造的假数据做演示，避免影响真实业务数据。

更新后的评估方向：

- 家长端应作为独立入口和独立页面组处理，而不是在现有后台菜单上做大量隐藏。
- 权限重点变为三类访问边界：老师真实后台、家长轻量端、演示账号演示空间。
- 演示账号如果要“显示所有功能且使用假数据”，需要数据隔离设计，避免演示数据与真实老师/家长数据混在一起。

用户追问演示数据隔离是否可以通过“一个网站项目连接两个数据库，并根据登录角色切换数据库”实现。

初步判断：

- 技术上可行，尤其当前使用 Prisma + SQLite，可以准备真实数据库和演示数据库两个 SQLite 文件。
- 登录/账号信息建议放在真实主库或单独认证配置中；登录成功后根据账号角色决定后续业务数据访问使用真实库还是演示库。
- 这种方式比在所有业务表里增加 `scope=real/demo` 更彻底，演示数据不会污染真实统计、排课、报表。
- 代价是迁移、种子数据、Prisma 客户端管理和测试都要同时覆盖两套数据库。

用户确认按最高性价比推进，并希望先准备开发步骤。

建议执行顺序：

1. 先做登录和角色底座：老师、家长、演示账号。
2. 再做 Prisma 双数据库客户端封装：真实业务库 + 演示业务库，根据当前登录账号选择业务库。
3. 迁移和 seed 脚本适配双库：真实库保留现有数据，演示库生成完整假数据。
4. 老师账号继续进入现有后台，使用真实业务库。
5. 演示账号进入现有后台，使用演示业务库。
6. 家长账号进入独立家长端，不开放当前后台菜单；后续再逐步增加家长端功能。
7. 最后补权限测试，重点验证家长不能访问后台、演示账号不读真实数据、老师不读演示数据。

用户进一步倾向于长期设计，决定现在就给所有核心业务表增加 `workspaceId`，而不是只用双数据库或临时角色判断。

更新后的方向：

- 引入 `Workspace` 作为数据空间/工作区概念。
- `User` 通过 `workspaceId` 绑定到工作区，`role` 决定功能权限，`workspaceId` 决定数据范围。
- 老师账号属于真实工作区，演示账号属于演示工作区；未来多位老师时，每位老师可以有自己的工作区。
- 家长账号也属于真实工作区，同时通过家长-学生绑定关系限制只能看到自己的孩子。
- 核心业务表应增加 `workspaceId`，包括学生、课程、学生选课、考试、知识点、知识点进度、薄弱点、复习计划、排课、考勤、沟通记录、课堂标签、薄弱点标签等。
- 这会提高第一版开发成本，但能显著降低未来从“一个老师”升级到“多老师独立管理”的返工成本。

已完成的第一轮实现：

- Prisma schema 新增 `Workspace`、`User`、`Session`、`ParentStudent`。
- 核心业务表已增加 `workspaceId`，课堂标签和薄弱点标签的唯一性改为工作区内唯一。
- 新增登录页 `/login`，账号角色包括 `teacher`、`parent`、`demo`。
- 新增会话 cookie、角色 cookie、密码哈希校验和退出登录接口。
- 新增中间件：未登录跳登录页；家长账号只能进入 `/parent`；老师和演示账号进入后台。
- 新增家长端入口 `/parent`，当前是轻量只读首页，展示绑定孩子的最近上课、最近成绩、固定安排和剩余课时。
- 老师和演示账号复用现有后台，但通过 `workspaceId` 读取各自工作区数据。
- seed 已生成三个默认账号：
  - `teacher / teacher123`：真实工作区老师账号
  - `parent / parent123`：真实工作区家长账号，绑定张三
  - `demo / demo123`：演示工作区账号
- seed 已生成两个工作区：
  - `default-real`：真实数据，10 名学生、4 门课程、28 条考试、17 个固定排课
  - `demo`：演示数据，1 名演示学生、1 门演示课程、1 条考试、1 条排课

验证结果：

- `npx prisma validate` 通过。
- `npx prisma generate` 通过。
- `npx prisma db push` 已同步 SQLite schema。
- `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts` 已成功重建数据。
- 新增检查脚本通过：
  - `scripts/check-auth-workspace-schema.mjs`
  - `scripts/check-auth-workspace-files.mjs`
  - `scripts/check-auth-routes.mjs`
- 关键旧检查脚本通过：
  - `scripts/check-lesson-review-schema.mjs`
  - `scripts/check-lesson-review-routes.mjs`
  - `scripts/check-student-lesson-hours.mjs`
  - `scripts/check-management-card-layouts.mjs`
- `npm run build` 通过。

当前限制：

- 在当前沙盒中启动 `npm run dev` 被端口监听权限拦截，错误为 `listen EPERM: operation not permitted 0.0.0.0:3000`；构建和数据库验证均已通过。
- 家长端已从第一版轻量入口继续扩展为完整家长端能力；具体完成记录见后续各日期小节。

### 2026-06-18 登录/退出 hooks 报错修复

用户反馈登录和退出登录时报错：`Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`

根因：

- `src/components/sidebar.tsx` 在调用 `usePathname`、`useRouter`、`useState` 后，先判断 `/login` 或 `/parent` 并 `return null`，然后才调用 `useEffect`。
- 当登录/退出导致路径在后台页、登录页、家长端之间切换时，`Sidebar` 每次渲染执行的 hooks 数量不一致，触发 React hooks 顺序错误。

处理：

- 将 `Sidebar` 的 `/login`、`/parent` 提前返回移动到所有 hooks 调用之后。
- 新增 `src/components/logout-button.tsx`，家长端退出也改为客户端调用 `/api/auth/logout` 后跳转 `/login`，避免普通表单提交后打开 JSON 响应。

验证：

- `npx tsc --noEmit` 通过。
- `node scripts/check-auth-workspace-schema.mjs && node scripts/check-auth-workspace-files.mjs && node scripts/check-auth-routes.mjs` 通过。
- `npm run build` 通过。

### 2026-06-18 管理员账号与账号管理

用户要求新增管理员账号。管理员和老师使用同一套后台页面，但左侧菜单额外显示“账号管理”，用于维护所有账号、重置密码、设置家长账号可见的学生。

已完成：

- 新增默认管理员 seed 账号：`admin / admin123`。
- `admin` 角色已加入后台访问权限，和老师、演示账号一样可以进入现有后台。
- 左侧侧边栏对管理员显示 `/accounts` “账号管理”菜单。
- 新增 `/accounts` 页面，只有管理员可访问。
- 新增 `/api/accounts`，只有管理员可调用。
- 账号管理支持：
  - 新增账号
  - 编辑姓名、账号、邮箱
  - 设置角色：管理员、老师、家长、演示
  - 设置所属工作区
  - 重置密码，留空则不修改
  - 为家长账号勾选可见学生，通常只选自己家的孩子
- 新增检查脚本：`scripts/check-admin-accounts.mjs`。

验证：

- `node scripts/check-admin-accounts.mjs && node scripts/check-auth-workspace-schema.mjs && node scripts/check-auth-workspace-files.mjs && node scripts/check-auth-routes.mjs && node scripts/check-management-card-layouts.mjs` 通过。
- `npm run build` 通过。

### 2026-06-18 家长端第一版功能结构

用户希望继续开发家长端，家长端和教师端结构保持一致，左侧菜单后续会重新设计。当前先按建议做 4 个入口：

- 孩子首页
- 上课记录
- 成绩记录
- 课程安排

已完成：

- 新增 `src/components/parent-sidebar.tsx`，家长端拥有独立左侧菜单。
- 新增 `src/app/parent/layout.tsx`，家长端使用左侧菜单 + 主内容区结构。
- 新增 `src/lib/parent-data.ts`，统一按当前家长账号和工作区读取绑定学生数据。
- 调整 `src/components/app-shell.tsx` 和根布局，使 `/parent` 不再被教师端主内容 padding 包裹，家长端可以完整铺开自己的布局。
- `/parent` 改为“孩子首页”，展示孩子概览、剩余课时、所属课程、当前薄弱点、最近上课、最近成绩、课程安排。
- 新增 `/parent/lessons`，展示上课记录、课堂内容、课堂反馈、标签和薄弱点标签。
- 新增 `/parent/exams`，展示成绩记录和平均得分率。
- 新增 `/parent/schedule`，展示固定安排和灵活安排。
- 新增检查脚本：`scripts/check-parent-portal.mjs`。

验证：

- `node scripts/check-parent-portal.mjs` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。

### 2026-06-19 家长端成绩曲线图

用户要求家长端“成绩记录”和教师端保持一致，显示曲线图。

已完成：

- 新增 `src/components/parent-exam-chart.tsx`，使用 Recharts 展示成绩趋势图。
- 家长端 `/parent/exams` 改为只读成绩分析页，包含：
  - 正式考试均分
  - 小测平均分
  - 最高得分率
  - 最低得分率
  - 进步幅度
  - 成绩趋势图
  - 考试明细列表
- 曲线图和教师端学生成绩详情页保持一致的表达方式：
  - 正式考试为蓝色实线
  - 随堂小测为橙色虚线
  - 显示平均分参考线
- 家长端仍然只读取当前家长绑定学生的数据。
- 新增检查脚本：`scripts/check-parent-exam-chart.mjs`。

验证：

- `node scripts/check-parent-exam-chart.mjs` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。

### 2026-06-19 家长端课程安排改为学习进度

用户要求家长端不再需要“课程安排”，改为教师端能看到的学习进度页面详情。

已完成：

- 家长端左侧菜单将“课程安排”替换为“学习进度”，入口为 `/parent/progress`。
- 删除家长端 `/parent/schedule` 页面。
- `src/lib/parent-data.ts` 增加 `kpProgress` 和 `knowledgePoint` 查询，薄弱点改为读取全部状态并包含复习计划。
- 新增 `/parent/progress` 只读学习进度页，参考教师端学习进度详情展示：
  - 知识点总数
  - 已掌握
  - 学习中
  - 整体进度
  - 知识点进度列表
  - 薄弱点复习列表
  - 当前薄弱、待复习、全部数量
  - 下次复习阶段、是否逾期
- 家长端不显示教师端的修改操作，例如切换知识点状态、添加薄弱点、标记复习结果。
- 新增检查脚本：`scripts/check-parent-progress.mjs`。

验证：

- `node scripts/check-parent-progress.mjs && node scripts/check-parent-portal.mjs` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。

备注：

- 删除 `/parent/schedule` 后，本地 `.next` 旧缓存曾引用已删除页面，已用 Node 文件系统方式清理 `.next` 后重新构建通过。

### 2026-06-19 资料中心：试卷/动画上传、搜索、预览、下载与授权

用户提出新增试卷下载和上传功能，显示在侧边栏。老师上传试卷，家长可以搜索、下载、预览；老师也可以上传动画，通常为 HTML 格式，学生/家长可查看和下载。试卷格式为 Word/PDF。随后用户明确：权限由管理员控制，不能查看的显示为上锁状态；demo 账号也应纳入管理员控制。

已完成：

- 新增 Prisma 模型：
  - `LearningResource`：资料记录，包含标题、说明、类型、文件名、存储名、mime、扩展名、大小、年级、课程、关键词、上传人、工作区。
  - `ResourcePermission`：资料授权，按 `resourceId + userId` 控制 `canPreview` 和 `canDownload`。
- 新增文件存储工具：
  - `src/lib/resource-storage.ts`
  - 上传文件存储在 `storage/resources/`，该目录已加入 `.gitignore`。
  - 支持 `.pdf`、`.doc`、`.docx`、`.html`、`.htm`。
- 新增权限工具：
  - `src/lib/resource-access.ts`
  - `admin`、`teacher` 可管理资料。
  - `parent`、`demo` 受 `ResourcePermission` 控制。
- 新增接口：
  - `GET /api/resources`：查询资料，返回 `locked`、`canPreview`、`canDownload`。
  - `POST /api/resources`：老师/管理员上传资料。
  - `GET /api/resources/[id]/file?mode=preview|download`：按权限预览或下载文件。
  - `POST /api/resource-permissions`：管理员设置资料授权。
- 新增页面：
  - `/resources`：后台资料中心，老师/管理员使用；管理员可看到所有工作区资料并进行授权。
  - `/parent/resources`：家长端资料中心，家长搜索资料；无权限资料显示“上锁”，预览/下载不可用。
- 侧边栏：
  - 教师/管理员后台侧边栏新增“资料中心”。
  - 家长端侧边栏新增“资料中心”。
- 演示数据：
  - seed 会生成一个 demo 工作区 HTML 动画资料，并给 demo 账号授权预览和下载。

验证：

- `node scripts/check-resource-center.mjs` 通过。
- `npx prisma validate` 通过。
- `npx prisma generate` 通过。
- `npx prisma db push` 通过。
- `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts` 通过。
- `npm run build` 通过。
- `npx tsc --noEmit` 通过。

### 2026-06-19 资料中心卡片与动画缩略图

用户要求动画资料最好做成卡片形式，并带缩略图。

已完成：

- `src/components/resource-center.tsx` 的资料展示从列表行改为响应式卡片网格。
- 新增 `ResourceThumbnail`：
  - 动画资料已解锁时，卡片顶部用沙盒 iframe 显示 HTML 缩略预览。
  - 动画资料未解锁时，卡片顶部显示上锁占位。
  - 试卷资料显示 PDF/Word 类型占位卡片。
- 检查脚本 `scripts/check-resource-center.mjs` 已更新，覆盖卡片缩略图和 iframe 沙盒要求。

验证：

- `node scripts/check-resource-center.mjs` 通过。
- `npm run build` 通过。
- `npx tsc --noEmit` 通过。

### 2026-06-19 服务器部署脚本

用户已购买服务器，希望把代码传到码云或 GitHub，并准备一键部署脚本。目标服务器推荐 Ubuntu 22.04 LTS。

已完成：

- 新增 `deploy/publish-repo.sh`：
  - 本地初始化 git（如还不是 git 仓库）。
  - 设置 GitHub/Gitee remote。
  - 提交并推送到指定分支。
- 新增 `deploy/server-init.sh`：
  - 用于服务器首次初始化。
  - 安装 Node.js 20、Git、Nginx、SQLite、PM2。
  - 创建 `/opt/student-management` 目录结构。
  - 创建共享 `.env`，默认 SQLite 路径为 `/opt/student-management/shared/dev.db`。
  - 调用 `deploy-update.sh` 完成首次部署。
  - 写入 Nginx 反向代理配置。
- 新增 `deploy/deploy-update.sh`：
  - 后续升级脚本。
  - 从 Git 仓库拉取新代码到 `releases/<timestamp>`。
  - 备份 SQLite 数据库。
  - 执行 `npm ci`、`prisma generate`、`prisma db push`、`npm run build`。
  - 使用 PM2 启动或重启应用。
  - 默认不执行 seed；只有设置 `RUN_SEED=1` 才会生成默认数据。
- 新增 `deploy/rollback.sh`：
  - 切换 `current` 到上一个 release 并重启 PM2。
- 新增 `deploy/README.md`：
  - 记录发布到 GitHub/Gitee、服务器初始化、正常更新、回滚、重要路径。
- 新增检查脚本：`scripts/check-deploy-scripts.mjs`。

验证：

- `node scripts/check-deploy-scripts.mjs` 通过。
- `bash -n deploy/publish-repo.sh` 通过。
- `bash -n deploy/server-init.sh` 通过。
- `bash -n deploy/deploy-update.sh` 通过。
- `bash -n deploy/rollback.sh` 通过。
- `npm run build` 通过。

注意：

- 生产首次空库部署默认只执行 `prisma db push`，不会跑 seed。
- 如果希望服务器生成默认 admin/teacher/parent/demo 账号，需要在首次部署后显式用 `RUN_SEED=1` 运行一次更新脚本；有真实数据后不要再使用 `RUN_SEED=1`。

### 2026-06-29 作业批改功能设计与第一版实现

用户提出新增作业批改功能，并已确认按结构化作业流推进。当前已开始第一版实现。

已确认业务设计：

- 老师端新增“作业批改”入口，课程详情页也显示该课程作业入口。
- 老师在课程中创建作业，填写标题、说明和可选截止时间。
- 老师上传题目文件和答案/解析文件，支持 Word 和 PDF。
- 当前第一版不再自动识别题目结构。老师在题目结构页填写“填空题有几题、选择题有几题、大题有几题、计算题有几题”，系统按数量生成题号和题型。
- 生成后的题目结构必须进入老师核对页，老师可修改题号、题型、分值、标准答案和解析后发布。
- 发布后按课程当前有效学生生成作业提交汇总。
- 家长端新增“作业”页面，家长只能看到自己孩子所属课程的已发布作业。
- 家长第一版只上传整份答案图片或 PDF，不在线逐题填写。
- 老师按学生提交版本逐题批改，填写每题得分、每题评语、总分和总评。
- 家长端可查看总分、总评、每题得分和每题评语。
- 老师批改页已改成三栏工作台：左侧预览学生答案，中间预览老师上传的答案/解析，右侧逐题批改；三栏分别滚动，右侧底部固定保存按钮。
- 答案/解析文件如果是 Word，系统会优先用 LibreOffice 转成 PDF 后在预览栏显示；中间栏按钮为“下载答案”，下载原始答案文件。若服务器没有 LibreOffice，Word 预览退回文本预览。
- `deploy/server-init.sh` 已加入 `libreoffice` 安装，用于生产环境 Word 转 PDF 预览。
- 已生成独立的“通用作业答题卡”PDF 模板，文件位于 `output/pdf/通用作业答题卡.pdf`。本轮暂不在网站内新增下载入口；后续如接入自动生成，可按老师设置的填空题、选择题、大题、计算题数量生成对应题号和答题区域。
- 家长作业详情页新增“下载答案/解析”，只允许下载自己孩子所属已发布作业的答案文件。老师作业详情页新增“删除作业”，删除数据库中的作业、题目结构、学生提交版本和批改记录；上传原始文件暂不物理删除。
- 按用户指定数量另生成专用答题卡：选择题 15 个、填空题 6 个、计算题 1 个、大题 8 个，文件位于 `output/pdf/作业答题卡-15选6填1算8大.pdf`。选择题选项为 ABCD；大题每页 2 题，答题留白为上一版的约 2 倍。
- 小程序同步作业功能：新增首页“作业”入口和 `pages/homework/index` 页面；新增移动端作业列表接口、上传接口和作业文件接口。家长可在小程序查看作业、查看题目、复制答案/解析下载链接、上传或重新上传答案、查看当前批改和提交历史。作业页不加入底部 tab，因为当前小程序已有 5 个 tab，微信小程序底部导航不能超过 5 个。
- 截止时间可选；超过截止时间且未提交时页面显示已逾期，但仍允许补交。
- 已批改后家长可以重新上传；系统创建新的提交版本，旧提交和旧批改保留。
- 第一版不做自动批改，也不把错题自动同步到薄弱点复习，但为后续扩展保留结构。

设计文档：

- `docs/superpowers/specs/2026-06-29-homework-grading-design.md`

实施文件：

- `prisma/schema.prisma` 新增 `HomeworkAssignment`、`HomeworkQuestion`、`HomeworkSubmission`、`HomeworkSubmissionVersion`、`HomeworkQuestionReview`。
- `src/lib/homework-storage.ts` 保存作业相关文件到 `storage/homework/`。
- `src/lib/homework-recognition.ts` 保留为后续可能恢复自动识别或接入 AI/OCR 的工具；当前主流程不调用自动识别。
- `src/lib/homework-access.ts` 提供作业权限和状态辅助。
- 老师端新增 `/homework`、`/homework/new`、`/homework/[id]`、`/homework/[id]/review-structure`、`/homework/[id]/submissions/[submissionId]`。
- 家长端新增 `/parent/homework`、`/parent/homework/[submissionId]`。
- 新增接口：`/api/homework`、`/api/homework/[id]`、`/api/homework/[id]/submissions/[submissionId]/grade`、`/api/homework/files/[kind]/[id]`、`/api/parent/homework`、`/api/parent/homework/[submissionId]/submit`。
- 新增检查脚本：`scripts/check-homework-grading-flow.mjs`。

后续调整：

- 用户用 `测试题目.docx` 和 `测试答案.docx` 上传后只识别出 1 道占位题。
- 根因：第一版只保存 Word 文件，没有抽取 `.docx` 文本；题号格式 `1．` 使用全角点，也不在原正则匹配范围内。
- 已新增 `.docx` 文本抽取逻辑，直接读取 Word 的 `word/document.xml`，并支持全角题号点。
- 新增回归脚本：`scripts/check-homework-docx-recognition.ts`。使用用户提供的测试题目和答案文件时，应识别出 24 道题。
- 之后用户决定当前界面不要自动识别，改为老师手动填写各题型数量生成题目结构；新建作业和题目结构页已撤掉自动识别入口。
