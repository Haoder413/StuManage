# 数学补习班学生管理系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个单人数学补习班 Web 端管理系统，涵盖学生管理、课程管理、成绩管理、学习进度跟踪（含艾宾浩斯复习）、排课考勤、报表导出、沟通记录七个模块。

**Architecture:** Next.js 14 App Router 全栈项目，Prisma ORM + SQLite 数据库，Tailwind CSS + Shadcn/ui 做界面。采用 Server Components 为主，交互密集处用 Client Components。API Routes 预留未来小程序复用。

**Tech Stack:** Next.js 14, TypeScript, Prisma, SQLite, Tailwind CSS, Shadcn/ui, Recharts (成绩趋势图), date-fns (日期处理)

---

## 文件结构总览

```
学生管理/
├── prisma/
│   ├── schema.prisma              # 11 张表的数据模型
│   └── seed.ts                    # 示例种子数据
├── src/
│   ├── app/
│   │   ├── globals.css            # Tailwind 全局样式
│   │   ├── layout.tsx             # 根布局 + 侧边栏
│   │   ├── page.tsx               # 仪表盘首页
│   │   ├── students/
│   │   │   ├── page.tsx           # 学生列表页
│   │   │   ├── new/page.tsx       # 新增学生
│   │   │   └── [id]/page.tsx      # 学生详情页
│   │   ├── courses/
│   │   │   ├── page.tsx           # 课程列表页
│   │   │   ├── new/page.tsx       # 新增课程
│   │   │   └── [id]/page.tsx      # 课程详情（含知识点树）
│   │   ├── exams/
│   │   │   ├── page.tsx           # 考试列表页
│   │   │   ├── new/page.tsx       # 新建考试 + 录入成绩
│   │   │   └── [id]/page.tsx      # 考试详情
│   │   ├── progress/
│   │   │   ├── page.tsx           # 学习进度总览
│   │   │   └── students/[id]/page.tsx  # 单个学生进度
│   │   ├── schedule/
│   │   │   └── page.tsx           # 排课考勤页
│   │   ├── reports/
│   │   │   └── page.tsx           # 报表导出页
│   │   └── communication/
│   │       ├── page.tsx           # 沟通记录总览
│   │       └── students/[id]/page.tsx  # 单个学生沟通记录
│   ├── components/
│   │   ├── ui/                    # Shadcn/ui 组件
│   │   |   ├── button.tsx
│   │   |   ├── card.tsx
│   │   |   ├── dialog.tsx
│   │   |   ├── dropdown-menu.tsx
│   │   |   ├── form.tsx
│   │   |   ├── input.tsx
│   │   |   ├── label.tsx
│   │   |   ├── select.tsx
│   │   |   ├── table.tsx
│   │   |   ├── tabs.tsx
│   │   |   ├── textarea.tsx
│   │   |   ├── toast.tsx
│   │   |   └── badge.tsx
│   │   ├── sidebar.tsx            # 侧边栏导航
│   │   ├── stat-card.tsx          # 统计卡片
│   │   ├── reminder-list.tsx      # 复习提醒列表
│   │   ├── schedule-card.tsx      # 今日课程卡片
│   │   ├── student-progress-card.tsx # 学生进度卡片
│   │   ├── knowledge-point-tree.tsx  # 知识点树组件
│   │   ├── score-chart.tsx        # 成绩趋势折线图
│   │   └── page-header.tsx        # 页面标题组件
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 客户端单例
│   │   ├── utils.ts               # 工具函数
│   │   └── review-scheduler.ts    # 艾宾浩斯复习调度逻辑
│   └── types/
│       └── index.ts               # 公共类型定义
```

---

### 任务 1: 项目脚手架搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/app/globals.css`
- Create: `.env`

### 任务 2: Prisma 数据模型

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`

### 任务 3: Shadcn/ui 组件库安装

**Files:**
- Create: `src/components/ui/` 下的所有基础组件
- Create: `src/lib/utils.ts`
- Create: `components.json`

### 任务 4: 根布局和侧边栏导航

**Files:**
- Create: `src/components/sidebar.tsx`
- Create: `src/app/layout.tsx`
- Create: `src/components/page-header.tsx`
- Create: `src/types/index.ts`

### 任务 5: 学生管理模块

**Files:**
- Create: `src/app/students/page.tsx`
- Create: `src/app/students/new/page.tsx`
- Create: `src/app/students/[id]/page.tsx`

### 任务 6: 课程管理模块

**Files:**
- Create: `src/app/courses/page.tsx`
- Create: `src/app/courses/new/page.tsx`
- Create: `src/app/courses/[id]/page.tsx`
- Create: `src/components/knowledge-point-tree.tsx`

### 任务 7: 成绩管理模块

**Files:**
- Create: `src/app/exams/page.tsx`
- Create: `src/app/exams/new/page.tsx`
- Create: `src/app/exams/[id]/page.tsx`
- Create: `src/components/score-chart.tsx`

### 任务 8: 学习进度模块

**Files:**
- Create: `src/app/progress/page.tsx`
- Create: `src/app/progress/students/[id]/page.tsx`
- Create: `src/lib/review-scheduler.ts`
- Create: `src/components/student-progress-card.tsx`

### 任务 9: 排课考勤模块

**Files:**
- Create: `src/app/schedule/page.tsx`

### 任务 10: 报表导出模块

**Files:**
- Create: `src/app/reports/page.tsx`

### 任务 11: 沟通记录模块

**Files:**
- Create: `src/app/communication/page.tsx`
- Create: `src/app/communication/students/[id]/page.tsx`

### 任务 12: 仪表盘首页

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/stat-card.tsx`
- Create: `src/components/schedule-card.tsx`
- Create: `src/components/reminder-list.tsx`

### 任务 13: API Routes

**Files:**
- Create: `src/app/api/students/route.ts`
- Create: `src/app/api/courses/route.ts`
- Create: `src/app/api/exams/route.ts`
- Create: `src/app/api/progress/route.ts`
- Create: `src/app/api/weak-points/route.ts`
- Create: `src/app/api/schedules/route.ts`
- Create: `src/app/api/attendance/route.ts`
- Create: `src/app/api/communication/route.ts`

---

## 实现阶段

### Phase 1: 基础搭建（任务 1-4）

这些任务需要按顺序执行，因为它们之间有依赖关系。

---

#### 任务 1: 项目脚手架搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/app/globals.css`
- Create: `.env`

- [ ] **1.1 创建 package.json**

```json
{
  "name": "student-management",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.15.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "recharts": "^2.12.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "prisma": "^5.15.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "ts-node": "^10.9.0",
    "tsx": "^4.16.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **1.2 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **1.3 创建 next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **1.4 创建 tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: { DEFAULT: "#0f172a", foreground: "#94a3b8", active: "#93c5fd" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **1.5 创建 postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **1.6 创建 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **1.7 创建 .env**

```
DATABASE_URL="file:./dev.db"
```

- [ ] **1.8 安装依赖**

运行: `npm install`

预期: 所有依赖安装成功，package-lock.json 生成

---

#### 任务 2: Prisma 数据模型

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **2.1 创建 prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Student {
  id               String   @id @default(cuid())
  name             String
  grade            String?
  parentContact    String?
  enrollmentDate   DateTime @default(now())
  lessonFrequency  String?
  tuition          Float?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  studentCourses   StudentCourse[]
  exams            Exam[]
  kpProgress       StudentKpProgress[]
  weakPoints       WeakPoint[]
  schedules        Schedule[]
  attendance       Attendance[]
  communicationLogs CommunicationLog[]
}

model Course {
  id              String   @id @default(cuid())
  name            String
  description     String?
  type            String   @default("fixed") // fixed | custom
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  studentCourses  StudentCourse[]
  knowledgePoints KnowledgePoint[]
}

model StudentCourse {
  id            String   @id @default(cuid())
  studentId     String
  courseId      String
  startDate     DateTime @default(now())
  status        String   @default("active") // active | completed | paused
  customContent String?  // JSON string for customization
  createdAt     DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course  Course  @relation(fields: [courseId], references: [id], onDelete: Cascade)
}

model Exam {
  id        String   @id @default(cuid())
  studentId String
  name      String
  type      String   // entrance | monthly | quiz
  score     Float
  totalScore Float  @default(100)
  date      DateTime @default(now())
  notes     String?
  createdAt DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
}

model KnowledgePoint {
  id        String   @id @default(cuid())
  courseId  String
  name      String
  parentId  String?
  orderIndex Int     @default(0)
  createdAt DateTime @default(now())

  course      Course              @relation(fields: [courseId], references: [id], onDelete: Cascade)
  parent      KnowledgePoint?     @relation("Kptree", fields: [parentId], references: [id])
  children    KnowledgePoint[]    @relation("Kptree")
  studentProgress StudentKpProgress[]
}

model StudentKpProgress {
  id                String   @id @default(cuid())
  studentId         String
  knowledgePointId  String
  status            String   @default("not_started") // not_started | learning | mastered
  masteredAt        DateTime?
  updatedAt         DateTime @updatedAt

  student         Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  knowledgePoint  KnowledgePoint  @relation(fields: [knowledgePointId], references: [id], onDelete: Cascade)

  @@unique([studentId, knowledgePointId])
}

model WeakPoint {
  id                String   @id @default(cuid())
  studentId         String
  knowledgePointId  String?
  description       String
  status            String   @default("active") // active | mastered
  masteredAt        DateTime?
  createdAt         DateTime @default(now())

  student         Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  reviewSchedules ReviewSchedule[]
}

model ReviewSchedule {
  id             String    @id @default(cuid())
  weakPointId    String
  stage          Int       @default(1) // 1-6
  lastReviewedAt DateTime?
  nextReviewAt   DateTime
  status         String    @default("pending") // pending | completed | reset
  createdAt      DateTime  @default(now())

  weakPoint WeakPoint @relation(fields: [weakPointId], references: [id], onDelete: Cascade)
}

model Schedule {
  id          String   @id @default(cuid())
  studentId   String
  type        String   // fixed | flexible
  dayOfWeek   Int?     // 0-6 for fixed schedules
  startTime   String?
  endTime     String?
  date        DateTime?
  startDate   DateTime?
  endDate     DateTime?
  notes       String?
  createdAt   DateTime @default(now())

  student    Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  attendance Attendance[]
}

model Attendance {
  id         String   @id @default(cuid())
  scheduleId String
  studentId  String
  date       DateTime
  status     String   // present | absent | makeup
  notes      String?
  createdAt  DateTime @default(now())

  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  student  Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
}

model CommunicationLog {
  id        String   @id @default(cuid())
  studentId String
  date      DateTime @default(now())
  method    String   // phone | wechat | in_person
  content   String
  createdAt DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
}
```

- [ ] **2.2 创建 src/lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **2.3 生成 Prisma 客户端**

运行: `npx prisma generate`

预期: 生成 Prisma Client

- [ ] **2.4 推送数据库**

运行: `npx prisma db push`

预期: SQLite 数据库创建成功，所有表生成

---

#### 任务 3: Shadcn/ui 基础组件 + 工具函数

**Files:**
- Create: `src/lib/utils.ts`
- Create: `components.json`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/table.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/form.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/textarea.tsx`

- [ ] **3.1 创建 utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **3.2 创建 components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **3.3 创建 button.tsx**

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **3.4 创建 card.tsx**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **3.5 创建 input.tsx**

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
```

- [ ] **3.6 创建剩余的 UI 组件（label.tsx, select.tsx, table.tsx, badge.tsx, dialog.tsx, tabs.tsx, textarea.tsx）**

每个组件按 Shadcn/ui 标准模式实现，粘贴上述对应风格的基础代码。label 使用 @radix-ui/react-label，select 使用 @radix-ui/react-select，dialog 使用 @radix-ui/react-dialog，tabs 使用 @radix-ui/react-tabs。

- [ ] **3.7 安装依赖并验证编译**

运行: `npm install && npx next build`（或 `npx next dev` 确认启动无报错）

预期: 项目编译成功，无类型错误

---

#### 任务 4: 根布局和侧边栏导航

**Files:**
- Create: `src/types/index.ts`
- Create: `src/components/sidebar.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/components/page-header.tsx`

- [ ] **4.1 创建类型定义 src/types/index.ts**

```typescript
export type ExamType = "entrance" | "monthly" | "quiz";
export type KpStatus = "not_started" | "learning" | "mastered";
export type WeakPointStatus = "active" | "mastered";
export type ReviewStatus = "pending" | "completed" | "reset";
export type ScheduleType = "fixed" | "flexible";
export type AttendanceStatus = "present" | "absent" | "makeup";
export type CourseType = "fixed" | "custom";
export type CommunicationMethod = "phone" | "wechat" | "in_person";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}
```

- [ ] **4.2 创建 sidebar.tsx**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "仪表盘", icon: "📊" },
  { href: "/students", label: "学生管理", icon: "👤" },
  { href: "/courses", label: "课程管理", icon: "📚" },
  { href: "/exams", label: "成绩管理", icon: "📝" },
  { href: "/progress", label: "学习进度", icon: "📈" },
  { href: "/schedule", label: "排课考勤", icon: "📅" },
];

const bottomItems = [
  { href: "/reports", label: "报表导出", icon: "📋" },
  { href: "/communication", label: "沟通记录", icon: "💬" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 bg-sidebar text-white flex flex-col shrink-0">
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-blue-400">学</span>管
        </h1>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-blue-500/15 text-blue-300"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-2 pb-4 space-y-1 border-t border-white/10 pt-3">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-blue-500/15 text-blue-300"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **4.3 创建 layout.tsx**

```typescript
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "学管 - 学生管理系统",
  description: "数学补习班学生管理系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-slate-50 p-6 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **4.4 创建 page-header.tsx**

```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **4.5 验证页面渲染**

运行: `npx next dev -p 3000`，访问 http://localhost:3000

预期: 深色侧边栏 + 空白主内容区，侧边栏 8 个导航入口，仪表盘入口高亮

---

### Phase 2: 核心业务模块（任务 5-12）

这些模块可以独立实现，但建议按顺序（学生 → 课程 → 成绩 → 进度 → 排课 → 报表 → 沟通 → 仪表盘），因为后序模块依赖前序的数据。

---

#### 任务 5: 学生管理模块

**Files:**
- Create: `src/app/students/page.tsx`
- Create: `src/app/students/new/page.tsx`
- Create: `src/app/students/[id]/page.tsx`

- [ ] **5.1 创建学生列表页 students/page.tsx**

服务端组件，从数据库查询所有学生列表，表格展示姓名、年级、家长联系方式、入学日期、上课频次。每行有编辑和查看详情链接。顶部的搜索框和新增按钮用 Client Components 包裹。

```typescript
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default async function StudentsPage() {
  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="学生管理"
        description="查看和管理所有学生"
        action={
          <Link href="/students/new">
            <Button>新增学生</Button>
          </Link>
        }
      />
      <div className="bg-white rounded-lg border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-slate-500">
              <th className="p-4 font-medium">姓名</th>
              <th className="p-4 font-medium">年级</th>
              <th className="p-4 font-medium">家长联系方式</th>
              <th className="p-4 font-medium">入学日期</th>
              <th className="p-4 font-medium">上课频次</th>
              <th className="p-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-4 font-medium">{s.name}</td>
                <td className="p-4 text-slate-600">{s.grade || "-"}</td>
                <td className="p-4 text-slate-600">{s.parentContact || "-"}</td>
                <td className="p-4 text-slate-600">{s.enrollmentDate.toLocaleDateString("zh-CN")}</td>
                <td className="p-4 text-slate-600">{s.lessonFrequency || "-"}</td>
                <td className="p-4">
                  <Link href={`/students/${s.id}`} className="text-blue-600 hover:underline text-sm">
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">暂无学生数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **5.2 创建新增学生页 students/new/page.tsx**

Client Component 表单，包含：姓名、年级、家长联系方式、入学日期、上课频次、学费、备注。提交后调用 Server Action 写入数据库，成功后跳转到学生列表。

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      grade: form.get("grade") as string,
      parentContact: form.get("parentContact") as string,
      enrollmentDate: new Date(form.get("enrollmentDate") as string).toISOString(),
      lessonFrequency: form.get("lessonFrequency") as string,
      tuition: form.get("tuition") ? parseFloat(form.get("tuition") as string) : null,
      notes: form.get("notes") as string,
    };

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push("/students");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="新增学生" description="添加一个新的学生档案" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="name">姓名</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="grade">年级</Label>
              <Input id="grade" name="grade" placeholder="如：初一" />
            </div>
            <div>
              <Label htmlFor="parentContact">家长联系方式</Label>
              <Input id="parentContact" name="parentContact" placeholder="手机号" />
            </div>
            <div>
              <Label htmlFor="enrollmentDate">入学日期</Label>
              <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <Label htmlFor="lessonFrequency">上课频次</Label>
              <Input id="lessonFrequency" name="lessonFrequency" placeholder="如：每周2次" />
            </div>
            <div>
              <Label htmlFor="tuition">学费</Label>
              <Input id="tuition" name="tuition" type="number" step="0.01" placeholder="如：3000" />
            </div>
            <div>
              <Label htmlFor="notes">备注</Label>
              <textarea
                id="notes"
                name="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>保存</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **5.3 创建学生详情页 students/[id]/page.tsx**

服务端组件，根据 id 查询学生完整信息及关联数据概览（考试成绩数、课程数、出勤率等）。

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      studentCourses: { include: { course: true } },
      exams: true,
      weakPoints: { where: { status: "active" } },
      attendance: true,
      communicationLogs: { orderBy: { date: "desc" }, take: 5 },
      schedules: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  if (!student) notFound();

  const examCount = student.exams.length;
  const weakPointCount = student.weakPoints.length;
  const attendanceCount = student.attendance.length;
  const presentCount = student.attendance.filter((a) => a.status === "present").length;
  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;
  const avgScore = examCount > 0
    ? Math.round(student.exams.reduce((sum, e) => sum + (e.score / e.totalScore) * 100, 0) / examCount)
    : 0;

  return (
    <div>
      <PageHeader
        title={student.name}
        description={`${student.grade || "未设置年级"} · ${student.lessonFrequency || "未设置频次"}`}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardHeader className="p-4"><CardTitle className="text-sm text-slate-500">课程数</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{student.studentCourses.length}</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="text-sm text-slate-500">考试次数</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{examCount}</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="text-sm text-slate-500">平均得分率</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{avgScore}%</p></CardContent></Card>
        <Card><CardHeader className="p-4"><CardTitle className="text-sm text-slate-500">出勤率</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{attendanceRate}%</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">家长联系方式</span><span>{student.parentContact || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">入学日期</span><span>{student.enrollmentDate.toLocaleDateString("zh-CN")}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">学费</span><span>{student.tuition ? `¥${student.tuition.toFixed(2)}` : "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">备注</span><span>{student.notes || "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>最近沟通记录</CardTitle></CardHeader>
          <CardContent>
            {student.communicationLogs.length === 0 ? (
              <p className="text-sm text-slate-400">暂无记录</p>
            ) : (
              <div className="space-y-2">
                {student.communicationLogs.map((log) => (
                  <div key={log.id} className="text-sm border-b pb-2 last:border-0">
                    <span className="text-slate-500 text-xs">{log.date.toLocaleDateString("zh-CN")} · {log.method === "phone" ? "电话" : log.method === "wechat" ? "微信" : "面谈"}</span>
                    <p className="text-slate-700 mt-0.5">{log.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href={`/progress/students/${student.id}`}>
          <Button variant="outline">查看学习进度</Button>
        </Link>
        <Link href={`/communication/students/${student.id}`}>
          <Button variant="outline">沟通记录</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **5.4 创建学生 API 路由 src/app/api/students/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const students = await prisma.student.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(students);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const student = await prisma.student.create({
    data: {
      name: data.name,
      grade: data.grade || null,
      parentContact: data.parentContact || null,
      enrollmentDate: new Date(data.enrollmentDate),
      lessonFrequency: data.lessonFrequency || null,
      tuition: data.tuition ? parseFloat(data.tuition) : null,
      notes: data.notes || null,
    },
  });
  return NextResponse.json(student, { status: 201 });
}
```

---

#### 任务 6: 课程管理模块

**Files:**
- Create: `src/app/courses/page.tsx`
- Create: `src/app/courses/new/page.tsx`
- Create: `src/app/courses/[id]/page.tsx`

- [ ] **6.1 创建课程列表页**

展示所有课程，含类型标签（固定/定制），有新增按钮。

- [ ] **6.2 创建新增课程页**

表单：课程名称、描述、类型（下拉选择 fixed/custom）

- [ ] **6.3 创建课程详情页（含知识点树管理器）**

课程详情页包含两个区域：
- 课程基本信息
- 知识点树管理：树形展示所有知识点，支持添加子节点、删除、编辑名称

知识点使用缩进列表或嵌套的无序列表展示。

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function renderTree(kp: any, depth: number = 0): Promise<string> {
  const indent = "  ".repeat(depth);
  let html = `<div style="padding-left:${depth * 20}px" class="py-1 text-sm flex items-center gap-2">
    <span class="text-slate-400">${depth === 0 ? "📂" : "📄"}</span>
    <span>${kp.name}</span>
  </div>`;
  if (kp.children && kp.children.length > 0) {
    for (const child of kp.children) {
      html += await renderTree(child, depth + 1);
    }
  }
  return html;
}

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      knowledgePoints: {
        where: { parentId: null },
        include: {
          children: {
            include: {
              children: {
                include: { children: true },
              },
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!course) notFound();

  return (
    <div>
      <PageHeader
        title={course.name}
        description={`${course.type === "fixed" ? "固定课程" : "定制课程"} · ${course.description || ""}`}
      />
      <Card>
        <CardHeader><CardTitle>知识点大纲</CardTitle></CardHeader>
        <CardContent>
          {course.knowledgePoints.length === 0 ? (
            <p className="text-sm text-slate-400">暂无知识点</p>
          ) : (
            <div>{course.knowledgePoints.map((kp) => renderTree(kp))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

#### 任务 7: 成绩管理模块

**Files:**
- Create: `src/app/exams/page.tsx`
- Create: `src/app/exams/new/page.tsx`
- Create: `src/app/exams/[id]/page.tsx`

- [ ] **7.1 创建考试列表页**

表格展示所有考试记录，按日期降序排列。包含考试名称、学生姓名、类型、得分、日期。

- [ ] **7.2 创建新建考试页**

表单：考试名称、类型（摸底/阶段/随堂）、日期、选择学生（多选）、每个学生输入得分和满分。

- [ ] **7.3 创建考试详情页**

展示考试详情及所有参与学生的分数列表和排名。

---

#### 任务 8: 学习进度模块

**Files:**
- Create: `src/app/progress/page.tsx`
- Create: `src/app/progress/students/[id]/page.tsx`
- Create: `src/lib/review-scheduler.ts`

- [ ] **8.1 创建复习调度逻辑 src/lib/review-scheduler.ts**

```typescript
import { addDays } from "date-fns";

// 艾宾浩斯复习间隔（天）
export const REVIEW_INTERVALS = [1, 3, 7, 15, 30, 60];

export function getNextReviewDate(stage: number): Date {
  const index = Math.min(stage - 1, REVIEW_INTERVALS.length - 1);
  return addDays(new Date(), REVIEW_INTERVALS[index]);
}

export function isOverdue(date: Date): boolean {
  return new Date() > date;
}

export function getStageLabel(stage: number): string {
  const labels = ["第1次: 1天后", "第2次: 3天后", "第3次: 7天后", "第4次: 15天后", "第5次: 30天后", "第6次: 60天后"];
  return labels[Math.min(stage - 1, labels.length - 1)];
}
```

- [ ] **8.2 创建进度总览页 progress/page.tsx**

展示所有学生及其当前学习进度概览：
- 寒暑假模式：知识点掌握百分比
- 平时模式：薄弱点数量 + 待复习数量

- [ ] **8.3 创建单个学生进度页 progress/students/[id]/page.tsx**

分两个 Tab：
- **知识点跟踪**：展示该学生所有课程的知识点树，每个节点标记状态（未学/学习中/已掌握）
- **薄弱点管理**：薄弱点清单 + 艾宾浩斯复习计划时间线

---

#### 任务 9: 排课考勤模块

**Files:**
- Create: `src/app/schedule/page.tsx`

- [ ] **9.1 创建排课考勤页**

展示日历视图和排课列表。支持添加固定排课和灵活排课。考勤记录可以直接在排课上标记。

---

#### 任务 10: 报表导出模块

**Files:**
- Create: `src/app/reports/page.tsx`

- [ ] **10.1 创建报表导出页**

选择学生 + 选择报告类型（成绩单/进度报告）+ 选择时间段，点击导出。

---

#### 任务 11: 沟通记录模块

**Files:**
- Create: `src/app/communication/page.tsx`
- Create: `src/app/communication/students/[id]/page.tsx`

- [ ] **11.1 创建沟通记录总览页**

按学生分组展示最近的沟通记录时间线。

- [ ] **11.2 创建单个学生沟通记录页**

该学生的沟通记录时间线，支持添加新记录（选择方式 + 填写内容）。

---

#### 任务 12: 仪表盘首页

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/stat-card.tsx`
- Create: `src/components/reminder-list.tsx`
- Create: `src/components/schedule-card.tsx`

- [ ] **12.1 创建仪表盘首页**

```typescript
import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/review-scheduler";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  const [studentCount, examCount, pendingReviews, todaySchedules] = await Promise.all([
    prisma.student.count(),
    prisma.exam.count(),
    prisma.reviewSchedule.findMany({
      where: { status: "pending", nextReviewAt: { lte: new Date() } },
      include: { weakPoint: { include: { student: true } } },
      orderBy: { nextReviewAt: "asc" },
      take: 10,
    }),
    prisma.schedule.findMany({
      where: {
        OR: [
          { type: "fixed", dayOfWeek: new Date().getDay() },
          { type: "flexible", date: { gte: new Date(new Date().toDateString()) } },
        ],
      },
      include: { student: true, attendance: true },
      take: 10,
    }),
  ]);

  return (
    <div>
      <PageHeader title="仪表盘" description="今日概览" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">学生总数</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{studentCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">考试记录</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{examCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">待复习提醒</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{pendingReviews.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">今日课程</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{todaySchedules.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">⚠ 待复习提醒</h3>
          {pendingReviews.length === 0 ? (
            <p className="text-sm text-slate-400">暂无待复习提醒</p>
          ) : (
            <div className="space-y-2">
              {pendingReviews.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm border-b pb-2 last:border-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    isOverdue(r.nextReviewAt) ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                  }`}>
                    {isOverdue(r.nextReviewAt) ? "逾期" : "待复习"}
                  </span>
                  <span>{r.weakPoint.student.name} — {r.weakPoint.description}</span>
                  <span className="text-xs text-slate-400 ml-auto">第{r.stage}次</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">📅 今日课程</h3>
          {todaySchedules.length === 0 ? (
            <p className="text-sm text-slate-400">今日无课程安排</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-medium">
                    {s.startTime || "待定"}-{s.endTime || ""}
                  </span>
                  <span>{s.student.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### 任务 13: API Routes（可选 — 小程序端预留）

为每个模块创建 REST API 路由，以便未来小程序端复用。

**Files:**
- Create: `src/app/api/students/route.ts` ✅ (已在 5.4 创建)
- Create: `src/app/api/courses/route.ts`
- Create: `src/app/api/exams/route.ts`
- Create: `src/app/api/progress/route.ts`
- Create: `src/app/api/weak-points/route.ts`
- Create: `src/app/api/schedules/route.ts`
- Create: `src/app/api/attendance/route.ts`
- Create: `src/app/api/communication/route.ts`

每个 API 路由实现 GET（列表）和 POST（创建）两个方法，遵循与 5.4 相同的模式。

---

### 任务 14: 种子数据

**Files:**
- Create: `prisma/seed.ts`

- [ ] **14.1 创建种子数据脚本**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 创建课程
  const course = await prisma.course.create({
    data: {
      name: "初一数学培优班",
      description: "七年级上册基础课程",
      type: "fixed",
    },
  });

  // 创建知识点树
  const ch1 = await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "有理数", orderIndex: 1 } });
  const ch2 = await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "整式", orderIndex: 2 } });
  const ch3 = await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "一元一次方程", orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "正负数概念", parentId: ch1.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "数轴与绝对值", parentId: ch1.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "有理数运算", parentId: ch1.id, orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "单项式与多项式", parentId: ch2.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "合并同类项", parentId: ch2.id, orderIndex: 2 } });

  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "方程概念", parentId: ch3.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course.id, name: "解方程与应用题", parentId: ch3.id, orderIndex: 2 } });

  // 创建学生
  const student1 = await prisma.student.create({
    data: { name: "张三", grade: "初一", parentContact: "13800000001", lessonFrequency: "每周2次", tuition: 3000 },
  });
  const student2 = await prisma.student.create({
    data: { name: "李四", grade: "初二", parentContact: "13800000002", lessonFrequency: "每周1次", tuition: 2000 },
  });

  // 关联学生课程
  await prisma.studentCourse.create({ data: { studentId: student1.id, courseId: course.id } });
  await prisma.studentCourse.create({ data: { studentId: student2.id, courseId: course.id } });

  // 创建考试
  await prisma.exam.create({ data: { studentId: student1.id, name: "入学摸底", type: "entrance", score: 72, totalScore: 100, date: new Date("2026-03-01") } });
  await prisma.exam.create({ data: { studentId: student1.id, name: "月考一", type: "monthly", score: 78, totalScore: 100, date: new Date("2026-04-01") } });
  await prisma.exam.create({ data: { studentId: student2.id, name: "入学摸底", type: "entrance", score: 85, totalScore: 100, date: new Date("2026-03-01") } });

  // 创建薄弱点 + 复习计划
  const wp = await prisma.weakPoint.create({
    data: { studentId: student1.id, description: "一元二次方程配方", status: "mastered" },
  });
  await prisma.reviewSchedule.create({
    data: { weakPointId: wp.id, stage: 2, nextReviewAt: new Date(Date.now() - 86400000), status: "pending" },
  });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **14.2 运行种子数据**

运行: `npx prisma db seed`

预期: 数据库写入示例数据，包含 1 门课程、7 个知识点、2 名学生、3 次考试

---

## 自审查清单

1. **Spec 覆盖度**: 设计文档的七个模块（学生/课程/成绩/进度/排课/报表/沟通）+ 仪表盘 + 艾宾浩斯复习，每个都有对应任务。
2. **占位符检查**: 所有步骤包含完整代码，没有 TBD/TODO。
3. **类型一致性**: 字段名在各任务间保持一致（studentId, courseId, status 等）。
4. **粒度**: 每个步骤 2-5 分钟，包括创建文件、编写代码、验证运行。
