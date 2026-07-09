# Parent Link Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复家长端时间管理、成绩记录和学习进度的学习关系隔离问题。

**Architecture:** 复用现有 `LearningLink`、`getParentLearningLinks` 和 `getParentLearningData`。时间管理个人安排解除学习关系绑定；成绩和学习进度页面改为当前学习关系驱动的服务端渲染。

**Tech Stack:** Next.js 14 App Router, React, Prisma, SQLite, existing Node static check scripts.

---

## File Structure

- Modify: `src/components/parent-time-management-client.tsx` removes the learning-link field from the personal schedule dialog and saves by selected student.
- Modify: `src/app/api/parent/schedule-items/route.ts` treats parent personal items as student-scoped only, with `learningLinkId=null` on create/update.
- Modify: `src/app/parent/exams/page.tsx` reads `link` search param and filters analysis/detail/chart by selected learning link.
- Modify: `src/components/parent-exam-chart.tsx` keeps chart rendering unchanged, receives already filtered exams.
- Modify: `src/app/parent/progress/page.tsx` reads `link` search param and uses `getParentLearningData`.
- Modify: `src/lib/parent-data.ts` ensures selected-link synthetic progress only uses selected course knowledge points.
- Modify: `docs/操作手册.md` and `docs/conversation-summary.md` with confirmed business rules.
- Create: `scripts/check-parent-link-isolation.mjs` static regression checks.

### Task 1: Regression Checks

- [ ] **Step 1: Write the failing check**

Create `scripts/check-parent-link-isolation.mjs` to assert:

```js
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(source, pattern, message) {
  if (!source.includes(pattern)) {
    console.error(message);
    process.exit(1);
  }
}

function assertNotIncludes(source, pattern, message) {
  if (source.includes(pattern)) {
    console.error(message);
    process.exit(1);
  }
}

const timeClient = read("src/components/parent-time-management-client.tsx");
const scheduleRoute = read("src/app/api/parent/schedule-items/route.ts");
const examsPage = read("src/app/parent/exams/page.tsx");
const progressPage = read("src/app/parent/progress/page.tsx");

assertNotIncludes(timeClient, "<Label className=\"text-xs text-gray-500\">学习关系</Label>", "personal schedule dialog should not show learning link field");
assertIncludes(timeClient, "studentId:", "personal schedule save should submit a student id");
assertIncludes(scheduleRoute, "learningLinkId: null", "parent personal schedule items should save without learning link binding");
assertIncludes(examsPage, "selectedLinkId", "parent exams page should track selected learning link");
assertIncludes(examsPage, "exam.learningLinkId === selectedLinkId", "parent exams should filter records by selected learning link");
assertIncludes(progressPage, "getParentLearningData", "parent progress should use selected learning-link data");
assertIncludes(progressPage, "selectedLinkId", "parent progress should expose selected learning-link state");

console.log("parent link isolation checks passed");
```

- [ ] **Step 2: Run check to verify it fails**

Run: `node scripts/check-parent-link-isolation.mjs`

Expected before implementation: FAIL because the personal schedule dialog still has a learning relationship field and exams/progress do not track `selectedLinkId`.

### Task 2: Time Management Personal Arrangements

- [ ] **Step 1: Implement minimal UI/data change**

Update `src/components/parent-time-management-client.tsx`:

- replace `learningLinkId` in form state with `studentId`
- build child options from `learningLinks`
- remove the dialog block with label `学习关系`
- save `studentId` and omit `learningLinkId`
- disable save when `studentId` is empty

- [ ] **Step 2: Update API behavior**

Update `src/app/api/parent/schedule-items/route.ts`:

- in `POST`, ignore `data.learningLinkId` and pass `learningLinkId: null`
- in `PATCH`, ignore `data.learningLinkId` and persist `learningLinkId: null`
- keep `ensureParentOwnsStudent` validation

- [ ] **Step 3: Run check**

Run: `node scripts/check-parent-link-isolation.mjs`

Expected: still may fail until exams/progress tasks are done, but time-management assertions should pass.

### Task 3: Parent Exam Link Filter

- [ ] **Step 1: Implement selected-link page state**

Update `src/app/parent/exams/page.tsx` to:

- accept `searchParams?: { link?: string }`
- choose selected link from active links or first link
- render link tabs/buttons above analysis
- filter official and pending exams with `exam.learningLinkId === selectedLinkId`
- show selected link label in section title

- [ ] **Step 2: Run check**

Run: `node scripts/check-parent-link-isolation.mjs`

Expected: progress assertion may still fail until Task 4.

### Task 4: Parent Progress Link Filter

- [ ] **Step 1: Implement selected-link progress page**

Update `src/app/parent/progress/page.tsx` to:

- accept `searchParams?: { link?: string; review?: string }`
- call `getParentLearningData(user, searchParams?.link)`
- render link tabs/buttons
- render only `parentStudents` returned by selected-link data
- show selected teacher and subject in title

- [ ] **Step 2: Verify selected-course synthetic progress**

Check `src/lib/parent-data.ts` to ensure `getParentLearningData` already filters `studentCourses` by `selectedLink.courseId` when present. Keep synthetic progress based on the filtered active course list.

- [ ] **Step 3: Run check**

Run: `node scripts/check-parent-link-isolation.mjs`

Expected: PASS.

### Task 5: Docs, Verification, Commit

- [ ] **Step 1: Update business docs**

Update `docs/操作手册.md` and `docs/conversation-summary.md` with the confirmed rules.

- [ ] **Step 2: Run verification**

Run:

```bash
node scripts/check-parent-link-isolation.mjs
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Commit all changes**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-07-09-parent-link-isolation-design.md docs/superpowers/plans/2026-07-09-parent-link-isolation.md scripts/check-parent-link-isolation.mjs src/components/parent-time-management-client.tsx src/app/api/parent/schedule-items/route.ts src/app/parent/exams/page.tsx src/app/parent/progress/page.tsx docs/操作手册.md docs/conversation-summary.md
git commit -m "fix: isolate parent learning link views"
```

Expected: commit succeeds and working tree only contains unrelated pre-existing changes, if any.

## Self Review

- Spec coverage: time management, exams, progress, course completion/new framework behavior, docs, and verification are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: page-level `selectedLinkId` and existing `learningLinkId` model fields are used consistently.
