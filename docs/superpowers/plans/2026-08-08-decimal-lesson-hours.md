# Decimal Lesson Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow lesson-hour balances and adjustments to use values with at most two decimal places.

**Architecture:** Centralize parsing and rounding in `src/lib/lesson-hours.ts`, then use it in attendance, student and history APIs. Store balances and log snapshots as Prisma `Float`, while HTML number inputs submit decimal values without integer truncation.

**Tech Stack:** Next.js, TypeScript, Prisma, SQLite, Node assertion scripts

---

### Task 1: Decimal validation

**Files:**
- Create: `src/lib/lesson-hours.ts`
- Create: `scripts/check-decimal-lesson-hours.ts`

- [ ] Write a failing source/behavior check for two-decimal parsing and schema/UI expectations.
- [ ] Run it and confirm failure because decimal support is absent.
- [ ] Implement `parseLessonHours` and `roundLessonHours` with a two-decimal limit.
- [ ] Run the check and confirm helper cases pass.

### Task 2: Storage and APIs

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/attendance/route.ts`
- Modify: `src/app/api/students/route.ts`
- Modify: `src/app/api/lesson-hour-logs/[id]/route.ts`

- [ ] Change balance and log fields from `Int` to `Float`.
- [ ] Apply the shared parser to every lesson-hour write API.
- [ ] Round balance changes and log snapshots to two decimals.
- [ ] Run the decimal check and Prisma validation.

### Task 3: Inputs and regression verification

**Files:**
- Modify: `src/app/schedule/page.tsx`
- Modify: `src/app/students/[id]/student-detail-editor.tsx`
- Modify: `src/app/students/[id]/lesson-hour-history-editor.tsx`
- Modify: existing lesson-hour check scripts
- Modify: `deploy/deploy-update.sh`
- Modify: `deploy/README.md`

- [ ] Change integer parsing to decimal parsing and set inputs to `step="0.01"`.
- [ ] Update helper text to explain the two-decimal rule.
- [ ] Run all lesson-hour checks, Prisma validation and production build.
- [ ] Verify the one-time Prisma data-loss confirmation switch is explicit and documented.
- [ ] Commit only the feature files and merge from a clean `origin/main` base before pushing `main`.
