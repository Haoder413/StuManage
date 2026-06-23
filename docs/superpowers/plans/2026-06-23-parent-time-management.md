# Parent Time Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the parent “上课记录” page with a read-only teacher-course calendar plus parent-owned personal schedule items.

**Architecture:** Add a separate `ParentScheduleItem` model for parent-owned personal items, expose it through a parent-only API, and render `/parent/lessons` as a client calendar that combines teacher schedules with personal items. Teacher schedules remain in `Schedule` and `Attendance`; parent items never enter attendance, lesson-hour, progress, or teacher schedule flows.

**Tech Stack:** Next.js App Router, React client component for calendar interaction, Prisma with SQLite, Tailwind CSS, existing UI primitives.

---

## File Structure

- Modify: `prisma/schema.prisma`
  - Add `Workspace.parentScheduleItems`, `User.parentScheduleItems`, `Student.parentScheduleItems`, `LearningLink.parentScheduleItems`, and the new `ParentScheduleItem` model.
- Create: `src/app/api/parent/schedule-items/route.ts`
  - Parent-only API for combined calendar reads and personal-item writes.
- Replace: `src/app/parent/lessons/page.tsx`
  - Server wrapper that loads parent learning-link options and renders the client calendar.
- Create: `src/components/parent-time-management-client.tsx`
  - Calendar UI, month/week switching, selected date/item detail panel, and personal item form.
- Modify: `src/components/parent-sidebar.tsx`
  - Change the parent nav label from “上课记录” to “时间管理”.
- Create: `scripts/check-parent-time-management.mjs`
  - Static regression checks for schema, API permissions, route replacement, and sidebar label.

---

### Task 1: Add Parent Schedule Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/check-parent-time-management.mjs`

- [ ] **Step 1: Write the failing schema/navigation check**

Create `scripts/check-parent-time-management.mjs` with:

```js
import { readFileSync } from "node:fs";

const checks = {
  "prisma/schema.prisma": [
    "model ParentScheduleItem",
    "parentId     String",
    "studentId    String",
    "learningLinkId String?",
    "parentScheduleItems ParentScheduleItem[]",
    "@@index([workspaceId, parentId, date])",
  ],
  "src/app/api/parent/schedule-items/route.ts": [
    "requireParent",
    "ensureParentOwnsStudent",
    "GET",
    "POST",
    "PATCH",
    "DELETE",
    "parentScheduleItem",
    "parentId: user.id",
  ],
  "src/app/parent/lessons/page.tsx": [
    "时间管理",
    "ParentTimeManagementClient",
    "getParentLearningLinks",
  ],
  "src/components/parent-time-management-client.tsx": [
    "type CalendarItem",
    "teacher_schedule",
    "parent_item",
    "月",
    "周",
    "老师安排",
    "个人安排",
    "待上课",
  ],
  "src/components/parent-sidebar.tsx": [
    "时间管理",
    "/parent/lessons",
  ],
};

const forbidden = {
  "src/components/parent-sidebar.tsx": ["上课记录"],
  "src/app/parent/lessons/page.tsx": ["flatMap(({ student }) => student.attendance"],
  "src/app/schedule/page.tsx": ["ParentScheduleItem", "parentScheduleItem"],
};

const missing = [];

for (const [file, snippets] of Object.entries(checks)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

for (const [file, snippets] of Object.entries(forbidden)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const snippet of snippets) {
    if (text.includes(snippet)) missing.push(`${file} should not include: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Parent time management check failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent time management files are present.");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `node scripts/check-parent-time-management.mjs`

Expected: FAIL with missing `model ParentScheduleItem`, missing API route, missing client component, and old parent lessons implementation.

- [ ] **Step 3: Add Prisma relations and model**

In `prisma/schema.prisma`, add relation fields:

```prisma
model Workspace {
  parentScheduleItems ParentScheduleItem[]
}

model User {
  parentScheduleItems ParentScheduleItem[]
}

model LearningLink {
  parentScheduleItems ParentScheduleItem[]
}

model Student {
  parentScheduleItems ParentScheduleItem[]
}
```

Add this model after `Attendance`:

```prisma
model ParentScheduleItem {
  id             String       @id @default(cuid())
  workspaceId    String       @default("default-real")
  parentId       String
  studentId      String
  learningLinkId String?
  title          String
  date           DateTime
  startTime      String
  endTime        String
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  workspace      Workspace    @relation(fields: [workspaceId], references: [id])
  parent         User         @relation(fields: [parentId], references: [id], onDelete: Cascade)
  student        Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  learningLink   LearningLink? @relation(fields: [learningLinkId], references: [id], onDelete: SetNull)

  @@index([workspaceId, parentId, date])
  @@index([workspaceId, studentId, date])
}
```

When adding relation fields, merge them into the existing models instead of creating duplicate `model Workspace`, `model User`, `model LearningLink`, or `model Student` blocks.

- [ ] **Step 4: Generate Prisma client**

Run: `npm run db:generate`

Expected: PASS with Prisma client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma scripts/check-parent-time-management.mjs
git commit -m "feat: add parent schedule item schema"
```

---

### Task 2: Build Parent Schedule Items API

**Files:**
- Create: `src/app/api/parent/schedule-items/route.ts`
- Test: `scripts/check-parent-time-management.mjs`

- [ ] **Step 1: Create the parent-only route**

Create `src/app/api/parent/schedule-items/route.ts` with these responsibilities:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseTags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

async function ensureParentOwnsStudent(user: { id: string; workspaceId: string }, studentId: string) {
  if (!studentId) return null;
  return prisma.parentStudent.findFirst({
    where: {
      parentId: user.id,
      studentId,
      student: { workspaceId: user.workspaceId },
    },
    include: { student: true },
  });
}

async function ensureParentCanUseLink(user: { id: string; workspaceId: string }, learningLinkId?: string | null) {
  if (!learningLinkId) return null;
  return prisma.learningLink.findFirst({
    where: {
      id: learningLinkId,
      workspaceId: user.workspaceId,
      parentId: user.id,
      isActive: true,
    },
    include: { student: true, teacher: true, course: true },
  });
}

function normalizeTime(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return /^\\d{2}:\\d{2}$/.test(text) ? text : fallback;
}

function normalizeDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}
```

Then implement `GET`:

```ts
export async function GET() {
  const user = await requireParent();
  const links = await prisma.learningLink.findMany({
    where: { workspaceId: user.workspaceId, parentId: user.id, isActive: true },
    include: {
      student: true,
      teacher: { select: { id: true, name: true, teachingSubject: true } },
      course: true,
    },
    orderBy: [{ student: { name: "asc" } }, { subject: "asc" }],
  });

  const studentIds = Array.from(new Set(links.map((link) => link.studentId)));
  const courseIds = Array.from(new Set(links.map((link) => link.courseId).filter((id): id is string => Boolean(id))));

  const schedules = await prisma.schedule.findMany({
    where: {
      workspaceId: user.workspaceId,
      OR: [
        { studentId: { in: studentIds } },
        { courseId: { in: courseIds } },
      ],
    },
    include: {
      student: true,
      course: {
        include: {
          studentCourses: {
            where: { status: "active", studentId: { in: studentIds } },
            include: { student: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      attendance: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const personalItems = await prisma.parentScheduleItem.findMany({
    where: { workspaceId: user.workspaceId, parentId: user.id },
    include: { student: true, learningLink: { include: { teacher: true, course: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const teacherItems = schedules.flatMap((schedule) => {
    if (schedule.studentId) {
      const link = links.find((item) => item.studentId === schedule.studentId);
      if (!link) return [];
      return [{
        kind: "teacher_schedule",
        id: schedule.id,
        scheduleId: schedule.id,
        learningLinkId: link.id,
        studentId: link.studentId,
        studentName: link.student.name,
        teacherName: link.teacher.name,
        subject: link.subject,
        title: schedule.course?.name || schedule.student?.name || "课程安排",
        courseName: schedule.course?.name || "",
        courseType: schedule.type,
        dayOfWeek: schedule.dayOfWeek,
        date: schedule.date?.toISOString() || null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        notes: schedule.notes,
        attendance: schedule.attendance.map((item) => ({
          id: item.id,
          studentId: item.studentId,
          date: item.date.toISOString(),
          status: item.status,
          lessonContent: item.lessonContent,
          lessonFeedback: item.lessonFeedback,
          contentTags: parseTags(item.contentTags),
          feedbackTags: parseTags(item.feedbackTags),
          weakPointTags: parseTags(item.weakPointTags),
        })),
      }];
    }

    return schedule.course?.studentCourses.map(({ student }) => {
      const link = links.find((item) => item.studentId === student.id && (!schedule.courseId || item.courseId === schedule.courseId));
      if (!link) return null;
      return {
        kind: "teacher_schedule",
        id: `${schedule.id}:${student.id}`,
        scheduleId: schedule.id,
        learningLinkId: link.id,
        studentId: student.id,
        studentName: student.name,
        teacherName: link.teacher.name,
        subject: link.subject,
        title: schedule.course?.name || "课程安排",
        courseName: schedule.course?.name || "",
        courseType: schedule.type,
        dayOfWeek: schedule.dayOfWeek,
        date: schedule.date?.toISOString() || null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        notes: schedule.notes,
        attendance: schedule.attendance
          .filter((item) => item.studentId === student.id)
          .map((item) => ({
            id: item.id,
            studentId: item.studentId,
            date: item.date.toISOString(),
            status: item.status,
            lessonContent: item.lessonContent,
            lessonFeedback: item.lessonFeedback,
            contentTags: parseTags(item.contentTags),
            feedbackTags: parseTags(item.feedbackTags),
            weakPointTags: parseTags(item.weakPointTags),
          })),
      };
    }).filter(Boolean) || [];
  });

  const parentItems = personalItems.map((item) => ({
    kind: "parent_item",
    id: item.id,
    studentId: item.studentId,
    studentName: item.student.name,
    learningLinkId: item.learningLinkId,
    title: item.title,
    date: item.date.toISOString(),
    startTime: item.startTime,
    endTime: item.endTime,
    notes: item.notes,
    teacherName: item.learningLink?.teacher?.name || "",
    subject: item.learningLink?.subject || "",
  }));

  return NextResponse.json({ links, items: [...teacherItems, ...parentItems] });
}
```

Implement write methods:

```ts
export async function POST(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const studentId = String(data.studentId || "");
  const ownedStudent = await ensureParentOwnsStudent(user, studentId);
  if (!ownedStudent) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const link = await ensureParentCanUseLink(user, data.learningLinkId ? String(data.learningLinkId) : null);
  if (data.learningLinkId && (!link || link.studentId !== studentId)) {
    return NextResponse.json({ error: "learning link not found" }, { status: 404 });
  }

  const date = normalizeDate(data.date);
  const title = String(data.title || "").trim();
  if (!date || !title) return NextResponse.json({ error: "missing title or date" }, { status: 400 });

  const item = await prisma.parentScheduleItem.create({
    data: {
      workspaceId: user.workspaceId,
      parentId: user.id,
      studentId,
      learningLinkId: link?.id || null,
      title,
      date,
      startTime: normalizeTime(data.startTime, "09:00"),
      endTime: normalizeTime(data.endTime, "10:00"),
      notes: String(data.notes || "").trim() || null,
    },
    include: { student: true, learningLink: { include: { teacher: true, course: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await requireParent();
  const data = await request.json();
  const id = String(data.id || "");
  const existing = await prisma.parentScheduleItem.findFirst({
    where: { id, workspaceId: user.workspaceId, parentId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const studentId = String(data.studentId || existing.studentId);
  const ownedStudent = await ensureParentOwnsStudent(user, studentId);
  if (!ownedStudent) return NextResponse.json({ error: "student not found" }, { status: 404 });

  const link = await ensureParentCanUseLink(user, data.learningLinkId ? String(data.learningLinkId) : null);
  if (data.learningLinkId && (!link || link.studentId !== studentId)) {
    return NextResponse.json({ error: "learning link not found" }, { status: 404 });
  }

  const date = data.date ? normalizeDate(data.date) : existing.date;
  const title = String(data.title || existing.title).trim();
  if (!date || !title) return NextResponse.json({ error: "missing title or date" }, { status: 400 });

  const item = await prisma.parentScheduleItem.update({
    where: { id },
    data: {
      studentId,
      learningLinkId: link?.id || null,
      title,
      date,
      startTime: normalizeTime(data.startTime, existing.startTime),
      endTime: normalizeTime(data.endTime, existing.endTime),
      notes: String(data.notes ?? existing.notes ?? "").trim() || null,
    },
    include: { student: true, learningLink: { include: { teacher: true, course: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(request: NextRequest) {
  const user = await requireParent();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const existing = await prisma.parentScheduleItem.findFirst({
    where: { id, workspaceId: user.workspaceId, parentId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.parentScheduleItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run the static check**

Run: `node scripts/check-parent-time-management.mjs`

Expected: FAIL until the page/client/sidebar tasks are completed, but API-related snippets should no longer be listed as missing.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/parent/schedule-items/route.ts
git commit -m "feat: add parent schedule items api"
```

---

### Task 3: Replace Parent Lessons With Time Management Calendar

**Files:**
- Replace: `src/app/parent/lessons/page.tsx`
- Create: `src/components/parent-time-management-client.tsx`
- Modify: `src/components/parent-sidebar.tsx`
- Test: `scripts/check-parent-time-management.mjs`

- [ ] **Step 1: Replace the server page**

Replace `src/app/parent/lessons/page.tsx` with:

```tsx
import { requireParent } from "@/lib/auth";
import { getParentLearningLinks, learningLinkLabel } from "@/lib/learning-links";
import { ParentTimeManagementClient } from "@/components/parent-time-management-client";

export default async function ParentLessonsPage() {
  const user = await requireParent();
  const links = await getParentLearningLinks(user);
  const linkOptions = links.map((link) => ({
    id: link.id,
    label: learningLinkLabel(link),
    studentId: link.studentId,
    studentName: link.student.name,
    teacherName: link.teacher.name,
    subject: link.subject,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">时间管理</h1>
        <p className="mt-1 text-sm text-slate-500">查看老师课程安排，管理家长自己的其他课程日程</p>
      </div>
      <ParentTimeManagementClient learningLinks={linkOptions} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `src/components/parent-time-management-client.tsx` with:

```tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

type LearningLinkOption = {
  id: string;
  label: string;
  studentId: string;
  studentName: string;
  teacherName: string;
  subject: string;
};

type AttendanceSnapshot = {
  id: string;
  studentId: string;
  date: string;
  status: string;
  lessonContent: string | null;
  lessonFeedback: string | null;
  contentTags: string[];
  feedbackTags: string[];
  weakPointTags: string[];
};

type CalendarItem = {
  kind: "teacher_schedule" | "parent_item";
  id: string;
  scheduleId?: string;
  learningLinkId?: string | null;
  studentId: string;
  studentName: string;
  teacherName?: string;
  subject?: string;
  title: string;
  courseName?: string;
  courseType?: string;
  dayOfWeek?: number | null;
  date?: string | null;
  startTime: string | null;
  endTime: string | null;
  notes?: string | null;
  attendance?: AttendanceSnapshot[];
};

type DatedCalendarItem = CalendarItem & {
  occurrenceDate: Date;
  occurrenceKey: string;
  attendanceForDate?: AttendanceSnapshot;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStart(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusLabel(status?: string) {
  if (status === "present") return "出勤";
  if (status === "makeup") return "补课";
  if (status === "absent") return "请假";
  return "待上课";
}

function TagList({ tags, emptyText = "暂无标签" }: { tags: string[]; emptyText?: string }) {
  if (!tags.length) return <p className="text-xs text-slate-400">{emptyText}</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
    </div>
  );
}

export function ParentTimeManagementClient({ learningLinks }: { learningLinks: LearningLinkOption[] }) {
  const today = new Date();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<DatedCalendarItem | null>(null);
  const [formLearningLinkId, setFormLearningLinkId] = useState(learningLinks[0]?.id || "");

  const selectedFormLink = learningLinks.find((link) => link.id === formLearningLinkId) || learningLinks[0] || null;

  async function loadItems() {
    setLoading(true);
    const response = await fetch("/api/parent/schedule-items");
    if (response.ok) {
      const data = await response.json();
      setItems(data.items || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: { day: number; currentMonth: boolean; date: Date }[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  }, [daysInMonth, daysInPrevMonth, month, startDayOfWeek, year]);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  }), [weekStart]);

  function occurrenceForDate(item: CalendarItem, date: Date): DatedCalendarItem | null {
    if (item.kind === "teacher_schedule" && item.courseType === "fixed" && item.dayOfWeek === date.getDay()) {
      const attendanceForDate = item.attendance?.find((att) => isSameDay(new Date(att.date), date));
      return { ...item, occurrenceDate: date, occurrenceKey: `${item.id}:${formatDateInput(date)}`, attendanceForDate };
    }
    if (item.date && isSameDay(new Date(item.date), date)) {
      const attendanceForDate = item.attendance?.find((att) => isSameDay(new Date(att.date), date));
      return { ...item, occurrenceDate: date, occurrenceKey: `${item.id}:${formatDateInput(date)}`, attendanceForDate };
    }
    return null;
  }

  function itemsForDate(date: Date) {
    return items
      .map((item) => occurrenceForDate(item, date))
      .filter((item): item is DatedCalendarItem => Boolean(item))
      .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  }

  function itemsForHour(date: Date, hour: number) {
    return itemsForDate(date).filter((item) => item.startTime && Number(item.startTime.split(":")[0]) === hour);
  }

  const selectedDateItems = itemsForDate(selectedDate);
  const selectedItem = selectedDateItems.find((item) => item.occurrenceKey === selectedItemKey) || null;
  const viewTitle = viewMode === "month"
    ? `${year}年 ${MONTH_NAMES[month]}`
    : `${formatDateInput(weekDays[0])} - ${formatDateInput(weekDays[6])}`;

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedItemKey("");
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function prev() {
    if (viewMode === "month") setCurrentMonth(new Date(year, month - 1, 1));
    else selectDate(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  }

  function next() {
    if (viewMode === "month") setCurrentMonth(new Date(year, month + 1, 1));
    else selectDate(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000));
  }

  function openAddForm() {
    setEditingItem(null);
    setFormLearningLinkId(learningLinks[0]?.id || "");
    setShowForm(true);
  }

  function openEditForm(item: DatedCalendarItem) {
    if (item.kind !== "parent_item") return;
    setEditingItem(item);
    setFormLearningLinkId(item.learningLinkId || learningLinks.find((link) => link.studentId === item.studentId)?.id || learningLinks[0]?.id || "");
    setShowForm(true);
  }

  async function deleteItem(item: DatedCalendarItem) {
    if (item.kind !== "parent_item" || !confirm("确定删除这个个人安排？")) return;
    const response = await fetch(`/api/parent/schedule-items?id=${item.id}`, { method: "DELETE" });
    if (response.ok) {
      await loadItems();
      setSelectedItemKey("");
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      id: editingItem?.id,
      studentId: selectedFormLink?.studentId,
      learningLinkId: selectedFormLink?.id || null,
      title: form.get("title"),
      date: form.get("date"),
      startTime: form.get("startTime"),
      endTime: form.get("endTime"),
      notes: form.get("notes"),
    };
    const response = await fetch("/api/parent/schedule-items", {
      method: editingItem ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setShowForm(false);
      await loadItems();
    }
  }

  if (learningLinks.length === 0) {
    return <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-400">暂无可查看的学习关系</div>;
  }

  return (
    <div className="flex gap-6">
      <div className="glass-card flex-1 rounded-xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => selectDate(today)} className="rounded-lg border border-gray-200/50 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100/50 hover:text-gray-800">今天</button>
            <div className="flex gap-0.5">
              <button onClick={prev} className="rounded-lg p-1.5 text-sm text-gray-400 hover:bg-gray-100/50">◀</button>
              <button onClick={next} className="rounded-lg p-1.5 text-sm text-gray-400 hover:bg-gray-100/50">▶</button>
            </div>
            <h2 className="text-base font-semibold text-gray-900">{viewTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={openAddForm}>新增个人安排</Button>
            <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
              <button onClick={() => setViewMode("month")} className={`rounded-md px-3 py-1 text-xs font-semibold ${viewMode === "month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>月</button>
              <button onClick={() => setViewMode("week")} className={`rounded-md px-3 py-1 text-xs font-semibold ${viewMode === "week" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>周</button>
            </div>
          </div>
        </div>

        {viewMode === "month" ? (
          <>
            <div className="mb-1 grid grid-cols-7">
              {DAY_NAMES.map((name) => <div key={name} className="py-1.5 text-center text-[11px] font-semibold text-gray-400">{name}</div>)}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-gray-100">
              {calendarDays.map((day) => {
                const dayItems = itemsForDate(day.date);
                const selected = isSameDay(day.date, selectedDate);
                return (
                  <button key={day.date.toISOString()} onClick={() => selectDate(day.date)} className={`min-h-[86px] border-b border-r border-gray-100 p-1.5 text-left ${selected ? "bg-blue-50/60" : "hover:bg-gray-50"} ${day.currentMonth ? "text-gray-700" : "text-gray-300"}`}>
                    <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">{day.day}</span>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <div key={item.occurrenceKey} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${item.kind === "teacher_schedule" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {item.startTime} {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && <p className="text-[10px] font-semibold text-blue-500">+{dayItems.length - 3}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <div className="sticky top-0 z-10 grid grid-cols-[50px_repeat(7,1fr)] bg-white/90 backdrop-blur">
              <div />
              {weekDays.map((date, index) => (
                <button key={date.toISOString()} onClick={() => selectDate(date)} className={`rounded-t-lg py-1.5 text-center ${isSameDay(date, selectedDate) ? "bg-blue-50/60" : ""}`}>
                  <div className="text-[10px] font-semibold text-gray-400">{DAY_NAMES[index]}</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-700">{date.getDate()}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-px bg-gray-50">
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="sticky left-0 bg-white py-3 pr-2 text-right text-[10px] text-gray-400">{hour}:00</div>
                  {weekDays.map((date) => (
                    <button key={`${date.toISOString()}-${hour}`} onClick={() => selectDate(date)} className={`min-h-[38px] border-b border-gray-100 px-1 py-0.5 text-left hover:bg-gray-50 ${isSameDay(date, selectedDate) ? "bg-blue-50/30" : ""}`}>
                      {itemsForHour(date, hour).map((item) => (
                        <div key={item.occurrenceKey} onClick={(event) => { event.stopPropagation(); selectDate(date); setSelectedItemKey(item.occurrenceKey); }} className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] font-medium ${item.kind === "teacher_schedule" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {item.title}
                        </div>
                      ))}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="glass-card w-80 shrink-0 self-start rounded-xl p-5">
        <div className="mb-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{selectedDate.getDate()}</div>
          <div className="mt-1 text-xs tracking-wide text-gray-400">{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月 · 周{DAY_NAMES[selectedDate.getDay()]}</div>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
        ) : selectedItem ? (
          <ItemDetail item={selectedItem} onEdit={openEditForm} onDelete={deleteItem} />
        ) : selectedDateItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">暂无课程安排</p>
        ) : (
          <div className="space-y-2">
            {selectedDateItems.map((item) => (
              <button key={item.occurrenceKey} onClick={() => setSelectedItemKey(item.occurrenceKey)} className="w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.kind === "teacher_schedule" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                    {item.kind === "teacher_schedule" ? "老师安排" : "个人安排"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">{item.startTime || "待定"} - {item.endTime || "待定"} · {item.studentName}</p>
              </button>
            ))}
          </div>
        )}
      </aside>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "编辑个人安排" : "新增个人安排"}</DialogTitle></DialogHeader>
          <form onSubmit={saveItem} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-gray-500">孩子 / 学习关系</Label>
              <Select value={formLearningLinkId} onValueChange={setFormLearningLinkId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {learningLinks.map((link) => <SelectItem key={link.id} value={link.id}>{link.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">标题</Label>
              <Input name="title" defaultValue={editingItem?.title || ""} placeholder="例如：英语课" required />
            </div>
            <div>
              <Label className="text-xs text-gray-500">日期</Label>
              <Input name="date" type="date" defaultValue={editingItem ? formatDateInput(editingItem.occurrenceDate) : formatDateInput(selectedDate)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">开始时间</Label>
                <Input name="startTime" type="time" defaultValue={editingItem?.startTime || "09:00"} required />
              </div>
              <div>
                <Label className="text-xs text-gray-500">结束时间</Label>
                <Input name="endTime" type="time" defaultValue={editingItem?.endTime || "10:00"} required />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">备注</Label>
              <Textarea name="notes" defaultValue={editingItem?.notes || ""} placeholder="可选" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>取消</Button>
              <Button type="submit" size="sm">保存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemDetail({
  item,
  onEdit,
  onDelete,
}: {
  item: DatedCalendarItem;
  onEdit: (item: DatedCalendarItem) => void;
  onDelete: (item: DatedCalendarItem) => void;
}) {
  const attendance = item.attendanceForDate;
  return (
    <div className="space-y-4 border-t border-gray-100 pt-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.kind === "teacher_schedule" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
            {item.kind === "teacher_schedule" ? "老师安排" : "个人安排"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">{item.startTime || "待定"} - {item.endTime || "待定"}</p>
      </div>

      <div className="grid gap-2 text-sm text-gray-600">
        <p>孩子：{item.studentName}</p>
        {item.teacherName && <p>老师：{item.teacherName}</p>}
        {item.subject && <p>科目：{item.subject}</p>}
        <p>状态：{statusLabel(attendance?.status)}</p>
      </div>

      {item.kind === "teacher_schedule" ? (
        <div className="space-y-4">
          <section>
            <p className="mb-1 text-xs font-semibold text-slate-500">上课内容</p>
            <p className="text-sm text-slate-600">{attendance?.lessonContent || "待老师课后填写"}</p>
            <TagList tags={attendance?.contentTags || []} />
          </section>
          <section>
            <p className="mb-1 text-xs font-semibold text-slate-500">老师评语</p>
            <p className="text-sm text-slate-600">{attendance?.lessonFeedback || "待老师课后填写"}</p>
            <TagList tags={attendance?.feedbackTags || []} />
          </section>
          <section>
            <p className="mb-1 text-xs font-semibold text-slate-500">薄弱点</p>
            <TagList tags={attendance?.weakPointTags || []} emptyText="暂无关联薄弱点" />
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <section>
            <p className="mb-1 text-xs font-semibold text-slate-500">备注</p>
            <p className="text-sm text-slate-600">{item.notes || "暂无备注"}</p>
          </section>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(item)}>编辑</Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(item)}>删除</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the parent sidebar label**

In `src/components/parent-sidebar.tsx`, change only this nav item:

```tsx
{ href: "/parent/lessons", label: "时间管理", icon: "📅" },
```

- [ ] **Step 4: Run the static check**

Run: `node scripts/check-parent-time-management.mjs`

Expected: PASS with `Parent time management files are present.`

- [ ] **Step 5: Commit**

```bash
git add src/app/parent/lessons/page.tsx src/components/parent-time-management-client.tsx src/components/parent-sidebar.tsx scripts/check-parent-time-management.mjs
git commit -m "feat: replace parent lessons with time calendar"
```

---

### Task 4: Wire Database and Build Verification

**Files:**
- Modify if needed: `prisma/schema.prisma`
- Test: generated Prisma client, static check, production build

- [ ] **Step 1: Apply schema locally**

Run: `npm run db:push`

Expected: PASS and SQLite schema updated with `ParentScheduleItem`.

- [ ] **Step 2: Regenerate Prisma client**

Run: `npm run db:generate`

Expected: PASS.

- [ ] **Step 3: Run the parent time management check**

Run: `node scripts/check-parent-time-management.mjs`

Expected: PASS with `Parent time management files are present.`

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS. The known warning `npm warn Unknown user config "sass_binary_site"` is acceptable if it appears and the build succeeds.

- [ ] **Step 5: Commit any verification fixes**

If Task 4 required edits, commit them:

```bash
git add prisma/schema.prisma src/app/api/parent/schedule-items/route.ts src/app/parent/lessons/page.tsx src/components/parent-time-management-client.tsx src/components/parent-sidebar.tsx scripts/check-parent-time-management.mjs
git commit -m "fix: verify parent time management flow"
```

If no edits were required, do not create an empty commit.

---

### Task 5: Manual UI Verification

**Files:**
- No planned source edits unless the checks reveal UI issues.

- [ ] **Step 1: Start the local app**

Run: `npm run dev`

Expected: local Next.js dev server starts, usually on `http://localhost:3000`.

- [ ] **Step 2: Check parent calendar rendering**

Open `/parent/lessons` as a parent account.

Expected:
- Sidebar says “时间管理”.
- Page title says “时间管理”.
- Month view renders by default.
- Week view can be selected.
- Teacher schedule cards are blue and marked “老师安排”.
- Personal items are green and marked “个人安排”.

- [ ] **Step 3: Check teacher schedule read-only detail**

Click a teacher schedule.

Expected:
- Detail panel shows child, teacher, subject, time, and status.
- If attendance exists, lesson content, teacher feedback, tags, and weak-point tags show.
- If attendance does not exist, status is “待上课” and feedback says “待老师课后填写”.
- No edit, delete, or attendance buttons appear for teacher schedules.

- [ ] **Step 4: Check parent personal item CRUD**

Create a personal item from the parent page, edit it, then delete it.

Expected:
- Created item appears on the selected date.
- Edited title/time/notes are reflected after save.
- Deleted item disappears.
- Teacher schedule cards are unaffected.

- [ ] **Step 5: Check teacher page isolation**

Open `/schedule` as a teacher or admin.

Expected:
- Parent personal items do not appear.
- Existing teacher schedule and attendance controls still work.

---

## Self-Review Notes

- Spec coverage: the plan covers route replacement, month/week views, read-only teacher schedules, parent-owned personal items, permissions, sidebar label, schema, API, and verification.
- Placeholder scan: no task uses TBD/TODO or “implement later”; the learning-link selection and submitted student id are fully specified in the client component example.
- Type consistency: the API emits `kind: "teacher_schedule" | "parent_item"` and the client uses the same union. `ParentScheduleItem` is consistently named across schema, API, script, and plan.
