# 教师端学习进度详情性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将教师端单个学生学习进度详情的请求从全量、重复嵌套数据改为按学生过滤的精简数据。

**Architecture:** 在现有 `/api/progress` GET 接口增加可选 `studentId` 查询参数，并复用教师可见性条件限制查询范围。详情页携带当前学生 ID；接口只选择页面需要的学生和知识点字段，合成记录不再嵌入完整课程知识点数组。

**Tech Stack:** Next.js 14 App Router、TypeScript、Prisma、Node.js 静态回归脚本

---

### Task 1: 建立性能回归约束

**Files:**
- Modify: `scripts/check-teacher-progress-detail-loading.mjs`

- [x] **Step 1: 写入失败检查**

在现有脚本中读取 `src/app/api/progress/route.ts`，并断言详情页使用 ``fetch(`/api/progress?studentId=${encodeURIComponent(studentId)}`)``；接口 GET 接收 `NextRequest`、读取 `studentId`、使用 `visibleStudentByIdWhere` 校验过滤；知识点使用 `select` 精简字段；合成的 `course` 不包含 `knowledgePoints`。

- [x] **Step 2: 运行检查并确认失败**

Run: `node scripts/check-teacher-progress-detail-loading.mjs`

Expected: FAIL，提示详情页尚未按 `studentId` 请求进度。

### Task 2: 实现按学生过滤和精简返回

**Files:**
- Modify: `src/app/api/progress/route.ts`
- Modify: `src/app/progress/students/[id]/page.tsx`

- [x] **Step 1: 修改 GET 查询参数与权限过滤**

把 GET 签名改为 `GET(request: NextRequest)`，读取 `request.nextUrl.searchParams.get("studentId")`。传入学生 ID 时先用 `visibleStudentByIdWhere(user, studentId)` 查询 `{ id, name, grade, lessonFrequency }`；不存在则返回 404。之后所有进度和在读课程知识点查询只限定该学生。

- [x] **Step 2: 精简 Prisma 返回字段**

已有进度仅选择 `id`、工作区/学习关系/学生/知识点 ID、状态、掌握及更新时间，学生仅选择 `id`、`name`、`grade`、`lessonFrequency`，知识点仅选择 `id`、`name`、`parentId`、`orderIndex`、`courseId` 和课程 `{ id, name }`。合成进度的 `knowledgePoint.course` 只包含 `{ id, name }`。

- [x] **Step 3: 详情页按当前学生请求**

将 `fetch("/api/progress")` 改为 ``fetch(`/api/progress?studentId=${encodeURIComponent(studentId)}`)``，保持现有异常处理与树构建逻辑不变。

- [x] **Step 4: 运行目标检查并确认通过**

Run: `node scripts/check-teacher-progress-detail-loading.mjs`

Expected: `Teacher progress detail loading checks passed.`

### Task 3: 同步文档并完成验证

**Files:**
- Modify: `docs/操作手册.md`
- Modify: `docs/conversation-summary.md`

- [x] **Step 1: 更新业务文档**

记录教师端学习进度详情只请求当前学生、每个知识点仅返回一次必要字段，不改变知识点树和状态操作。

- [x] **Step 2: 运行相关回归检查**

Run: `node scripts/check-teacher-progress-detail-loading.mjs && node scripts/check-teacher-data-isolation.mjs && npx tsc --noEmit`

Expected: 两个脚本通过，TypeScript 退出码为 0。

- [x] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: Next.js build 退出码为 0。

- [x] **Step 4: 检查改动并提交**

运行 `git diff --check`，确认只提交本轮性能修复、测试、计划和文档，提交信息使用 `fix: speed up progress detail loading`。
