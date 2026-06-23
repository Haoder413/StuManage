import { PrismaClient } from "@prisma/client";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const resourceDir = path.join(process.cwd(), "storage", "resources");

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 100_000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

async function main() {
  // Clean existing data
  await prisma.session.deleteMany();
  await prisma.resourceCoursePermission.deleteMany();
  await prisma.resourcePermission.deleteMany();
  await prisma.learningResource.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.reviewSchedule.deleteMany();
  await prisma.weakPoint.deleteMany();
  await prisma.lessonTag.deleteMany();
  await prisma.weakPointTag.deleteMany();
  await prisma.studentKpProgress.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.studentCourse.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.workspace.deleteMany();

  const realWorkspace = await prisma.workspace.create({
    data: { id: "default-real", name: "真实教学工作区", kind: "real" },
  });
  const demoWorkspace = await prisma.workspace.create({
    data: { id: "demo", name: "功能演示工作区", kind: "demo" },
  });

  await prisma.user.create({
    data: {
      workspaceId: realWorkspace.id,
      name: "管理员",
      phone: "admin",
      role: "admin",
      passwordHash: hashPassword("admin123"),
    },
  });
  const teacherUser = await prisma.user.create({
    data: {
      workspaceId: realWorkspace.id,
      name: "老师",
      phone: "teacher",
      role: "teacher",
      teachingSubject: "数学",
      passwordHash: hashPassword("teacher123"),
    },
  });
  await prisma.user.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: "演示账号",
      phone: "demo",
      role: "demo",
      passwordHash: hashPassword("demo123"),
    },
  });
  const parentUser = await prisma.user.create({
    data: {
      workspaceId: realWorkspace.id,
      name: "张三家长",
      phone: "parent",
      role: "parent",
      passwordHash: hashPassword("parent123"),
    },
  });

  // ==========================================
  // Courses with Knowledge Points
  // ==========================================

  const course1 = await prisma.course.create({
    data: { name: "初一数学培优班", description: "七年级上册基础课程（暑假班）", type: "fixed" },
  });
  const course2 = await prisma.course.create({
    data: { name: "初二数学提高班", description: "八年级重点难点突破", type: "fixed" },
  });
  const course3 = await prisma.course.create({
    data: { name: "初三数学冲刺班", description: "中考复习与压轴题训练", type: "fixed" },
  });
  const course4 = await prisma.course.create({
    data: { name: "小学数学思维训练", description: "4-6年级数学思维拓展", type: "custom" },
  });

  // --- Course 1: 初一数学知识树 ---
  const c1_ch1 = await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "有理数", orderIndex: 1 } });
  const c1_ch2 = await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "整式的加减", orderIndex: 2 } });
  const c1_ch3 = await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "一元一次方程", orderIndex: 3 } });
  const c1_ch4 = await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "几何图形初步", orderIndex: 4 } });

  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "正负数与数轴", parentId: c1_ch1.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "绝对值与相反数", parentId: c1_ch1.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "有理数四则运算", parentId: c1_ch1.id, orderIndex: 3 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "有理数混合运算", parentId: c1_ch1.id, orderIndex: 4 } });

  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "单项式与多项式", parentId: c1_ch2.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "合并同类项", parentId: c1_ch2.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "去括号与添括号", parentId: c1_ch2.id, orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "方程的概念与解", parentId: c1_ch3.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "解一元一次方程", parentId: c1_ch3.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "一元一次方程应用题", parentId: c1_ch3.id, orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "点、线、面、体", parentId: c1_ch4.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course1.id, name: "角的认识与度量", parentId: c1_ch4.id, orderIndex: 2 } });

  // --- Course 2: 初二数学知识树 ---
  const c2_ch1 = await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "三角形", orderIndex: 1 } });
  const c2_ch2 = await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "全等三角形", orderIndex: 2 } });
  const c2_ch3 = await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "轴对称", orderIndex: 3 } });
  const c2_ch4 = await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "整式乘法与因式分解", orderIndex: 4 } });

  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "三角形边的关系", parentId: c2_ch1.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "三角形内角和", parentId: c2_ch1.id, orderIndex: 2 } });

  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "全等三角形的判定", parentId: c2_ch2.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "全等三角形的应用", parentId: c2_ch2.id, orderIndex: 2 } });

  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "等腰三角形", parentId: c2_ch3.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "垂直平分线", parentId: c2_ch3.id, orderIndex: 2 } });

  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "平方差公式", parentId: c2_ch4.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "完全平方公式", parentId: c2_ch4.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "因式分解（提公因式）", parentId: c2_ch4.id, orderIndex: 3 } });
  await prisma.knowledgePoint.create({ data: { courseId: course2.id, name: "因式分解（公式法）", parentId: c2_ch4.id, orderIndex: 4 } });

  // --- Course 3: 初三数学知识树 ---
  const c3_ch1 = await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "二次函数", orderIndex: 1 } });
  const c3_ch2 = await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "圆", orderIndex: 2 } });
  const c3_ch3 = await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "相似三角形", orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "二次函数的图象与性质", parentId: c3_ch1.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "二次函数的最值问题", parentId: c3_ch1.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "二次函数与一元二次方程", parentId: c3_ch1.id, orderIndex: 3 } });

  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "圆的基本性质", parentId: c3_ch2.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "圆周角与圆心角", parentId: c3_ch2.id, orderIndex: 2 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "直线与圆的位置关系", parentId: c3_ch2.id, orderIndex: 3 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "扇形与圆锥", parentId: c3_ch2.id, orderIndex: 4 } });

  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "相似三角形的判定", parentId: c3_ch3.id, orderIndex: 1 } });
  await prisma.knowledgePoint.create({ data: { courseId: course3.id, name: "相似三角形的应用", parentId: c3_ch3.id, orderIndex: 2 } });

  // ==========================================
  // Students
  // ==========================================

  const studentsData = [
    { name: "张三", grade: "初一", parentContact: "13800000001", lessonFrequency: "每周2次", tuition: 3200, notes: "数学基础较好，计算能力需要加强" },
    { name: "李四", grade: "初二", parentContact: "13800000002", lessonFrequency: "每周1次", tuition: 2400, notes: "几何部分较弱，需要重点辅导" },
    { name: "王五", grade: "初一", parentContact: "13800000003", lessonFrequency: "每周2次", tuition: 3200, notes: "学习态度认真，做题速度偏慢" },
    { name: "赵六", grade: "初三", parentContact: "13800000004", lessonFrequency: "每周3次", tuition: 4800, notes: "中考冲刺，函数和几何都需要补" },
    { name: "孙七", grade: "小六", parentContact: "13800000005", lessonFrequency: "每周1次", tuition: 2000, notes: "小升初准备，思维训练为主" },
    { name: "周八", grade: "初二", parentContact: "13800000006", lessonFrequency: "每周2次", tuition: 2800, notes: "因式分解和全等三角形比较吃力" },
    { name: "吴九", grade: "初三", parentContact: "13800000007", lessonFrequency: "每周2次", tuition: 4000, notes: "目标是重点高中，压轴题需要突破" },
    { name: "郑十", grade: "初一", parentContact: "13800000008", lessonFrequency: "每周1次", tuition: 2400, notes: "刚上初中，需要适应中学数学思维" },
    { name: "陈十一", grade: "小五", parentContact: "13800000009", lessonFrequency: "每周1次", tuition: 2000, notes: "对数学有兴趣，参加思维拓展课程" },
    { name: "林十二", grade: "初二", parentContact: "13800000010", lessonFrequency: "每周2次", tuition: 2800, notes: "基础不错，想提前学初三内容" },
  ];

  const students = [];
  for (const s of studentsData) {
    students.push(await prisma.student.create({
      data: {
        name: s.name,
        grade: s.grade,
        parentContact: s.parentContact,
        enrollmentDate: new Date("2026-02-01"),
        lessonFrequency: s.lessonFrequency,
        tuition: s.tuition,
        notes: s.notes,
      },
    }));
  }

  await prisma.parentStudent.create({
    data: { parentId: parentUser.id, studentId: students[0].id },
  });

  // ==========================================
  // Link Students to Courses
  // ==========================================

  const enrollments = [
    { studentIdx: 0, courseIdx: 0 }, { studentIdx: 0, courseIdx: 3 },
    { studentIdx: 1, courseIdx: 1 },
    { studentIdx: 2, courseIdx: 0 },
    { studentIdx: 3, courseIdx: 2 }, { studentIdx: 3, courseIdx: 1 },
    { studentIdx: 4, courseIdx: 3 },
    { studentIdx: 5, courseIdx: 1 },
    { studentIdx: 6, courseIdx: 2 },
    { studentIdx: 7, courseIdx: 0 }, { studentIdx: 7, courseIdx: 3 },
    { studentIdx: 8, courseIdx: 3 },
    { studentIdx: 9, courseIdx: 1 }, { studentIdx: 9, courseIdx: 2 },
  ];

  const allCourses = [course1, course2, course3, course4];
  for (const e of enrollments) {
    await prisma.studentCourse.create({
      data: { studentId: students[e.studentIdx].id, courseId: allCourses[e.courseIdx].id },
    });
  }

  const learningLinksByStudentIdx = new Map<number, string>();
  const zhangSanMathLink = await prisma.learningLink.create({
    data: {
      workspaceId: realWorkspace.id,
      parentId: parentUser.id,
      studentId: students[0].id,
      teacherId: teacherUser.id,
      courseId: course1.id,
      subject: "数学",
    },
  });
  learningLinksByStudentIdx.set(0, zhangSanMathLink.id);

  // ==========================================
  // Exams
  // ==========================================

  const examData = [
    // 张三 (初一)
    { studentIdx: 0, name: "入学摸底", type: "entrance", score: 72, date: "2026-03-01" },
    { studentIdx: 0, name: "月考一", type: "monthly", score: 78, date: "2026-04-05" },
    { studentIdx: 0, name: "期中考试", type: "monthly", score: 85, date: "2026-05-10" },
    { studentIdx: 0, name: "随堂小测-有理数", type: "quiz", score: 88, date: "2026-03-20" },
    { studentIdx: 0, name: "随堂小测-整式", type: "quiz", score: 82, date: "2026-04-18" },
    // 李四 (初二)
    { studentIdx: 1, name: "入学摸底", type: "entrance", score: 65, date: "2026-03-01" },
    { studentIdx: 1, name: "月考一", type: "monthly", score: 70, date: "2026-04-05" },
    { studentIdx: 1, name: "随堂小测-三角形", type: "quiz", score: 60, date: "2026-03-25" },
    // 王五 (初一)
    { studentIdx: 2, name: "入学摸底", type: "entrance", score: 80, date: "2026-03-01" },
    { studentIdx: 2, name: "月考一", type: "monthly", score: 76, date: "2026-04-05" },
    { studentIdx: 2, name: "随堂小测-有理数", type: "quiz", score: 90, date: "2026-03-22" },
    // 赵六 (初三)
    { studentIdx: 3, name: "入学摸底", type: "entrance", score: 58, date: "2026-03-01" },
    { studentIdx: 3, name: "月考一", type: "monthly", score: 62, date: "2026-04-05" },
    { studentIdx: 3, name: "中考模拟一", type: "monthly", score: 71, date: "2026-05-15" },
    { studentIdx: 3, name: "随堂小测-二次函数", type: "quiz", score: 55, date: "2026-03-28" },
    // 孙七 (小六)
    { studentIdx: 4, name: "入学评估", type: "entrance", score: 88, date: "2026-03-01" },
    { studentIdx: 4, name: "阶段测试", type: "monthly", score: 92, date: "2026-04-10" },
    // 周八 (初二)
    { studentIdx: 5, name: "入学摸底", type: "entrance", score: 52, date: "2026-03-01" },
    { studentIdx: 5, name: "月考一", type: "monthly", score: 58, date: "2026-04-05" },
    { studentIdx: 5, name: "随堂小测-因式分解", type: "quiz", score: 45, date: "2026-04-20" },
    // 吴九 (初三)
    { studentIdx: 6, name: "入学摸底", type: "entrance", score: 82, date: "2026-03-01" },
    { studentIdx: 6, name: "月考一", type: "monthly", score: 86, date: "2026-04-05" },
    { studentIdx: 6, name: "中考模拟一", type: "monthly", score: 88, date: "2026-05-15" },
    // 郑十 (初一)
    { studentIdx: 7, name: "入学摸底", type: "entrance", score: 90, date: "2026-03-01" },
    { studentIdx: 7, name: "随堂小测-有理数", type: "quiz", score: 93, date: "2026-03-20" },
    // 陈十一 (小五)
    { studentIdx: 8, name: "入学评估", type: "entrance", score: 85, date: "2026-03-01" },
    // 林十二 (初二)
    { studentIdx: 9, name: "入学摸底", type: "entrance", score: 78, date: "2026-03-01" },
    { studentIdx: 9, name: "随堂小测-全等三角形", type: "quiz", score: 84, date: "2026-04-15" },
  ];

  for (const e of examData) {
    await prisma.exam.create({
      data: {
        studentId: students[e.studentIdx].id,
        learningLinkId: learningLinksByStudentIdx.get(e.studentIdx),
        name: e.name,
        type: e.type,
        score: e.score,
        totalScore: 100,
        date: new Date(e.date),
        reviewStatus: "approved",
        submittedById: teacherUser.id,
        reviewedById: teacherUser.id,
        reviewedAt: new Date(e.date),
      },
    });
  }

  // ==========================================
  // Knowledge Point Progress (for summer course students)
  // ==========================================

  // All KPs for course1 (初一)
  const c1Kps = await prisma.knowledgePoint.findMany({ where: { courseId: course1.id } });
  // Students enrolled in course1: 张三(0), 王五(2), 郑十(7)
  for (const studentIdx of [0, 2, 7]) {
    for (const kp of c1Kps) {
      const statuses = ["mastered", "learning", "learning", "not_started", "not_started"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await prisma.studentKpProgress.create({
        data: {
          studentId: students[studentIdx].id,
          learningLinkId: learningLinksByStudentIdx.get(studentIdx),
          knowledgePointId: kp.id,
          status,
          masteredAt: status === "mastered" ? new Date() : null,
        },
      });
    }
  }

  // All KPs for course2 (初二)
  const c2Kps = await prisma.knowledgePoint.findMany({ where: { courseId: course2.id } });
  for (const studentIdx of [1, 5, 9]) {
    for (const kp of c2Kps) {
      const statuses = ["mastered", "learning", "learning", "not_started"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await prisma.studentKpProgress.create({
        data: {
          studentId: students[studentIdx].id,
          learningLinkId: learningLinksByStudentIdx.get(studentIdx),
          knowledgePointId: kp.id,
          status,
          masteredAt: status === "mastered" ? new Date() : null,
        },
      });
    }
  }

  // ==========================================
  // Weak Points & Review Schedules (Ebbinghaus)
  // ==========================================

  const weakPointData = [
    { studentIdx: 0, desc: "有理数混合运算（去括号易错）", mastered: true, stage: 2, overdue: true },
    { studentIdx: 0, desc: "一元一次方程应用题（行程问题）", mastered: true, stage: 1, overdue: false },
    { studentIdx: 1, desc: "全等三角形的判定（不会找对应边）", mastered: false },
    { studentIdx: 1, desc: "三角形内角和定理的证明", mastered: true, stage: 3, overdue: true },
    { studentIdx: 2, desc: "合并同类项（符号错误）", mastered: true, stage: 1, overdue: false },
    { studentIdx: 2, desc: "代数式的化简求值", mastered: false },
    { studentIdx: 3, desc: "二次函数顶点式不会推导", mastered: false },
    { studentIdx: 3, desc: "圆的切线与证明", mastered: true, stage: 4, overdue: true },
    { studentIdx: 3, desc: "扇形面积计算", mastered: false },
    { studentIdx: 4, desc: "分数混合运算", mastered: true, stage: 2, overdue: false },
    { studentIdx: 5, desc: "因式分解十字相乘法", mastered: false },
    { studentIdx: 5, desc: "平方差公式的灵活运用", mastered: true, stage: 1, overdue: false },
    { studentIdx: 6, desc: "相似三角形的动点问题", mastered: false },
    { studentIdx: 6, desc: "二次函数中的面积最值", mastered: false },
    { studentIdx: 6, desc: "圆与直线的综合题", mastered: true, stage: 2, overdue: true },
    { studentIdx: 7, desc: "数轴上的动点问题", mastered: false },
    { studentIdx: 7, desc: "有理数的乘方运算", mastered: true, stage: 1, overdue: false },
    { studentIdx: 9, desc: "垂直平分线的性质证明", mastered: false },
  ];

  for (const w of weakPointData) {
    const wp = await prisma.weakPoint.create({
      data: {
        studentId: students[w.studentIdx].id,
        learningLinkId: learningLinksByStudentIdx.get(w.studentIdx),
        description: w.desc,
        status: w.mastered ? "mastered" : "active",
        masteredAt: w.mastered ? new Date() : null,
      },
    });
    if (w.mastered && w.stage) {
      const intervalDays = [1, 3, 7, 15, 30, 60];
      const nextDate = new Date();
      if (w.overdue) {
        nextDate.setDate(nextDate.getDate() - 1);
      } else {
        nextDate.setDate(nextDate.getDate() + intervalDays[w.stage - 1]);
      }
      await prisma.reviewSchedule.create({
        data: {
          weakPointId: wp.id,
          stage: w.stage,
          nextReviewAt: nextDate,
          status: "pending",
        },
      });
    }
  }

  // ==========================================
  // Schedules
  // ==========================================

  const fixedScheduleData = [
    { studentIdx: 0, dayOfWeek: 1, start: "14:00", end: "15:30" },
    { studentIdx: 0, dayOfWeek: 4, start: "14:00", end: "15:30" },
    { studentIdx: 1, dayOfWeek: 3, start: "16:00", end: "17:30" },
    { studentIdx: 2, dayOfWeek: 2, start: "14:00", end: "15:30" },
    { studentIdx: 2, dayOfWeek: 5, start: "14:00", end: "15:30" },
    { studentIdx: 3, dayOfWeek: 1, start: "16:00", end: "17:30" },
    { studentIdx: 3, dayOfWeek: 3, start: "16:00", end: "17:30" },
    { studentIdx: 3, dayOfWeek: 6, start: "09:00", end: "11:00" },
    { studentIdx: 4, dayOfWeek: 5, start: "10:00", end: "11:00" },
    { studentIdx: 5, dayOfWeek: 2, start: "16:00", end: "17:30" },
    { studentIdx: 5, dayOfWeek: 4, start: "16:00", end: "17:30" },
    { studentIdx: 6, dayOfWeek: 3, start: "19:00", end: "21:00" },
    { studentIdx: 6, dayOfWeek: 6, start: "14:00", end: "16:00" },
    { studentIdx: 7, dayOfWeek: 6, start: "10:00", end: "11:30" },
    { studentIdx: 8, dayOfWeek: 5, start: "16:00", end: "17:00" },
    { studentIdx: 9, dayOfWeek: 2, start: "19:00", end: "20:30" },
    { studentIdx: 9, dayOfWeek: 5, start: "19:00", end: "20:30" },
  ];

  for (const s of fixedScheduleData) {
    await prisma.schedule.create({
      data: {
        studentId: students[s.studentIdx].id,
        type: "fixed",
        dayOfWeek: s.dayOfWeek,
        startTime: s.start,
        endTime: s.end,
      },
    });
  }

  // ==========================================
  // Attendance Records
  // ==========================================

  const now = new Date();
  const contentTagSamples = ["函数图像", "几何证明", "计算训练", "错题订正", "预习新课"];
  const feedbackTagSamples = ["课堂专注", "计算粗心", "思路清晰", "作业未完成", "需要复习"];

  for (const name of contentTagSamples) {
    await prisma.lessonTag.create({ data: { name, type: "content" } });
  }
  for (const name of feedbackTagSamples) {
    await prisma.lessonTag.create({ data: { name, type: "feedback" } });
  }

  for (let d = 0; d < 14; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

    for (const s of fixedScheduleData) {
      if (s.dayOfWeek === date.getDay() && Math.random() > 0.15) {
        const statuses: ("present" | "absent" | "makeup")[] = ["present", "present", "present", "absent", "makeup"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        await prisma.attendance.create({
          data: {
            scheduleId: (await prisma.schedule.findFirst({
              where: { studentId: students[s.studentIdx].id, type: "fixed", dayOfWeek: s.dayOfWeek },
            }))!.id,
            studentId: students[s.studentIdx].id,
            learningLinkId: learningLinksByStudentIdx.get(s.studentIdx),
            date,
            status,
            notes: status === "absent" ? "请假" : status === "makeup" ? "补课" : null,
            lessonContent: status === "absent" ? null : "完成本次知识点讲解与典型题训练",
            lessonFeedback: status === "absent" ? null : "课堂参与度较好，课后需要继续整理错题",
            contentTags: status === "absent" ? null : JSON.stringify(contentTagSamples.slice(0, 2)),
            feedbackTags: status === "absent" ? null : JSON.stringify(feedbackTagSamples.slice(0, 2)),
          },
        });
      }
    }
  }

  // ==========================================
  // Communication Logs
  // ==========================================

  const commLogs = [
    { studentIdx: 0, method: "phone", content: "与家长沟通近期学习情况，数学成绩稳步提升", date: "2026-06-10" },
    { studentIdx: 0, method: "wechat", content: "发送了期中考试成绩单，家长表示满意", date: "2026-05-12" },
    { studentIdx: 1, method: "phone", content: "沟通了几何部分薄弱的问题，建议增加练习量", date: "2026-06-08" },
    { studentIdx: 1, method: "wechat", content: "发送了因式分解专项练习题", date: "2026-06-12" },
    { studentIdx: 2, method: "wechat", content: "反馈上课表现良好，做题速度有所提升", date: "2026-06-11" },
    { studentIdx: 3, method: "phone", content: "详细沟通了中考冲刺计划，家长表示全力配合", date: "2026-06-01" },
    { studentIdx: 3, method: "wechat", content: "发送了中考模拟一成绩分析", date: "2026-05-16" },
    { studentIdx: 4, method: "phone", content: "了解了小升初目标学校，调整了教学计划", date: "2026-06-05" },
    { studentIdx: 5, method: "wechat", content: "发送了因式分解错题订正要求", date: "2026-06-13" },
    { studentIdx: 5, method: "phone", content: "讨论学习方法，建议每天做10道计算题", date: "2026-06-07" },
    { studentIdx: 6, method: "phone", content: "沟通了压轴题解题策略，孩子进步明显", date: "2026-06-09" },
    { studentIdx: 7, method: "wechat", content: "反馈入学适应良好，有理数部分掌握扎实", date: "2026-06-12" },
    { studentIdx: 8, method: "phone", content: "沟通了思维训练课程安排", date: "2026-06-03" },
    { studentIdx: 9, method: "wechat", content: "发送了全等三角形专项练习题", date: "2026-06-10" },
    { studentIdx: 9, method: "phone", content: "沟通了提前学习初三课程的计划", date: "2026-05-28" },
  ];

  for (const log of commLogs) {
    await prisma.communicationLog.create({
      data: {
        studentId: students[log.studentIdx].id,
        method: log.method,
        content: log.content,
        date: new Date(log.date),
      },
    });
  }

  // ==========================================
  // Demo Workspace Data
  // ==========================================

  const demoCourse = await prisma.course.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: "演示课程：初中数学综合提升",
      description: "用于功能演示的完整课程数据",
      type: "fixed",
    },
  });
  const demoKp = await prisma.knowledgePoint.create({
    data: {
      workspaceId: demoWorkspace.id,
      courseId: demoCourse.id,
      name: "函数与几何综合",
      orderIndex: 1,
    },
  });
  const demoStudent = await prisma.student.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: "演示学生",
      grade: "初二",
      parentContact: "demo-parent",
      enrollmentDate: new Date("2026-06-01"),
      lessonFrequency: "每周2次",
      tuition: 3600,
      totalLessonHours: 40,
      remainingLessonHours: 32,
      notes: "这是一条演示数据，不属于真实学生。",
    },
  });
  await prisma.studentCourse.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      courseId: demoCourse.id,
    },
  });
  await prisma.exam.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      name: "演示月考",
      type: "monthly",
      score: 86,
      totalScore: 100,
      date: new Date("2026-06-10"),
    },
  });
  await prisma.studentKpProgress.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      knowledgePointId: demoKp.id,
      status: "learning",
    },
  });
  const demoWeakPoint = await prisma.weakPoint.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      knowledgePointId: demoKp.id,
      description: "动点问题中不会建立函数关系",
      status: "mastered",
      masteredAt: new Date("2026-06-12"),
    },
  });
  await prisma.reviewSchedule.create({
    data: {
      workspaceId: demoWorkspace.id,
      weakPointId: demoWeakPoint.id,
      stage: 2,
      nextReviewAt: new Date("2026-06-20"),
      status: "pending",
    },
  });
  const demoSchedule = await prisma.schedule.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      type: "fixed",
      dayOfWeek: 4,
      startTime: "18:30",
      endTime: "20:00",
    },
  });
  await prisma.attendance.create({
    data: {
      workspaceId: demoWorkspace.id,
      scheduleId: demoSchedule.id,
      studentId: demoStudent.id,
      date: new Date("2026-06-18"),
      status: "present",
      lessonContent: "函数模型与几何动点综合题",
      lessonFeedback: "能跟上主要思路，建模步骤还需要继续练习",
      contentTags: JSON.stringify(["函数图像", "几何证明"]),
      feedbackTags: JSON.stringify(["思路清晰", "需要复习"]),
    },
  });
  await prisma.communicationLog.create({
    data: {
      workspaceId: demoWorkspace.id,
      studentId: demoStudent.id,
      method: "wechat",
      content: "演示沟通记录：本周重点练习函数建模。",
      date: new Date("2026-06-18"),
    },
  });
  await prisma.lessonTag.createMany({
    data: [
      { workspaceId: demoWorkspace.id, name: "演示内容标签", type: "content" },
      { workspaceId: demoWorkspace.id, name: "演示反馈标签", type: "feedback" },
    ],
  });
  await prisma.weakPointTag.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: "演示薄弱点标签",
      category: "函数",
    },
  });

  mkdirSync(resourceDir, { recursive: true });
  const demoHtmlName = "demo-animation.html";
  writeFileSync(
    path.join(resourceDir, demoHtmlName),
    "<!doctype html><html><body><h1>函数动画演示</h1><p>这是一份演示 HTML 动画资料。</p></body></html>",
    "utf8"
  );
  const demoResource = await prisma.learningResource.create({
    data: {
      workspaceId: demoWorkspace.id,
      title: "演示动画：函数图像变化",
      description: "用于演示资料中心预览和下载权限。",
      type: "animation",
      fileName: "函数动画演示.html",
      storedName: demoHtmlName,
      mimeType: "text/html; charset=utf-8",
      extension: ".html",
      size: 98,
      grade: "初二",
      keywords: "函数 动画 演示",
      uploadedById: (await prisma.user.findFirstOrThrow({ where: { phone: "demo" } })).id,
    },
  });
  await prisma.resourcePermission.create({
    data: {
      workspaceId: demoWorkspace.id,
      resourceId: demoResource.id,
      userId: (await prisma.user.findFirstOrThrow({ where: { phone: "demo" } })).id,
      canPreview: true,
      canDownload: true,
    },
  });

  console.log("✅ 种子数据生成完成！");
  console.log("🔐 登录账号：admin/admin123, teacher/teacher123, parent/parent123, demo/demo123");
  console.log(`📚 ${4} 门课程`);
  console.log(`🎓 ${students.length} 名学生`);
  console.log(`📝 ${examData.length} 次考试成绩`);
  console.log(`📈 ${c1Kps.length + c2Kps.length} 个知识点`);
  console.log(`⚠️ ${weakPointData.length} 个薄弱点`);
  console.log(`📅 ${fixedScheduleData.length} 个固定排课`);
  console.log(`💬 ${commLogs.length} 条沟通记录`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
