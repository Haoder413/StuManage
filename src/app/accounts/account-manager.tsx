"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  teachingSubject: string | null;
  workspaceId: string;
  workspaceName: string;
  parentStudentIds: string[];
  learningLinks: string[];
};

type WorkspaceOption = {
  id: string;
  name: string;
  kind: string;
};

type StudentOption = {
  id: string;
  workspaceId: string;
  name: string;
  grade: string | null;
};

type CourseOption = {
  id: string;
  workspaceId: string;
  name: string;
};

type TeacherOption = {
  id: string;
  workspaceId: string;
  name: string;
  teachingSubject: string | null;
};

type ParentOption = {
  id: string;
  workspaceId: string;
  name: string;
};

type LearningLinkOption = {
  id: string;
  workspaceId: string;
  parentId: string;
  studentId: string;
  teacherId: string;
  courseId: string | null;
  subject: string;
  isActive: boolean;
  parentName: string;
  studentName: string;
  teacherName: string;
  courseName: string | null;
};

const blankForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  role: "parent",
  teachingSubject: "数学",
  workspaceId: "default-real",
  password: "",
  parentStudentIds: [] as string[],
};

const blankLearningLink = {
  id: "",
  workspaceId: "default-real",
  parentId: "",
  studentId: "",
  teacherId: "",
  courseId: "",
  subject: "数学",
  isActive: true,
};

export function AccountManager({
  initialUsers,
  workspaces,
  students,
  courses,
  teachers,
  parents,
  learningLinks: initialLearningLinks,
}: {
  initialUsers: Account[];
  workspaces: WorkspaceOption[];
  students: StudentOption[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  parents: ParentOption[];
  learningLinks: LearningLinkOption[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(blankForm);
  const [learningLinks, setLearningLinks] = useState(initialLearningLinks);
  const [selectedLearningLink, setSelectedLearningLink] = useState(blankLearningLink);
  const [message, setMessage] = useState("");
  const isEditing = Boolean(form.id);
  const isEditingLearningLink = Boolean(selectedLearningLink.id);
  const visibleStudents = useMemo(
    () => students.filter((student) => student.workspaceId === form.workspaceId),
    [students, form.workspaceId]
  );
  const linkStudents = useMemo(
    () => students.filter((student) => student.workspaceId === selectedLearningLink.workspaceId),
    [students, selectedLearningLink.workspaceId]
  );
  const linkTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.workspaceId === selectedLearningLink.workspaceId),
    [teachers, selectedLearningLink.workspaceId]
  );
  const linkParents = useMemo(
    () => parents.filter((parent) => parent.workspaceId === selectedLearningLink.workspaceId),
    [parents, selectedLearningLink.workspaceId]
  );
  const linkCourses = useMemo(
    () => courses.filter((course) => course.workspaceId === selectedLearningLink.workspaceId),
    [courses, selectedLearningLink.workspaceId]
  );

  function editAccount(account: Account) {
    setMessage("");
    setForm({
      id: account.id,
      name: account.name,
      phone: account.phone || "",
      email: account.email || "",
      role: account.role,
      teachingSubject: account.teachingSubject || "数学",
      workspaceId: account.workspaceId,
      password: "",
      parentStudentIds: account.parentStudentIds,
    });
  }

  function startCreateAccount() {
    setMessage("");
    setForm(blankForm);
  }

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      parentStudentIds: current.parentStudentIds.includes(studentId)
        ? current.parentStudentIds.filter((id) => id !== studentId)
        : [...current.parentStudentIds, studentId],
    }));
  }

  async function saveAccount() {
    setMessage("");
    const method = isEditing ? "PATCH" : "POST";
    const response = await fetch("/api/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const saved = await response.json();
    if (!response.ok) {
      setMessage(saved.error || "保存失败");
      return;
    }
    const workspaceName = workspaces.find((workspace) => workspace.id === saved.workspaceId)?.name || "";
    const normalized = {
      id: saved.id,
      name: saved.name,
      phone: saved.phone,
      email: saved.email,
      role: saved.role,
      teachingSubject: saved.teachingSubject,
      workspaceId: saved.workspaceId,
      workspaceName,
      parentStudentIds: saved.parentStudents?.map((item: { studentId: string }) => item.studentId) || [],
      learningLinks: saved.learningLinksAsParent?.map((item: { id: string }) => item.id) || [],
    };
    setUsers((current) => isEditing
      ? current.map((item) => item.id === normalized.id ? normalized : item)
      : [...current, normalized]
    );
    setForm(blankForm);
    setMessage("已保存账号");
  }

  function editLearningLink(link: LearningLinkOption) {
    setMessage("");
    setSelectedLearningLink({
      id: link.id,
      workspaceId: link.workspaceId,
      parentId: link.parentId,
      studentId: link.studentId,
      teacherId: link.teacherId,
      courseId: link.courseId || "",
      subject: link.subject,
      isActive: link.isActive,
    });
  }

  function updateTeacherForLink(teacherId: string) {
    const teacher = teachers.find((item) => item.id === teacherId);
    setSelectedLearningLink((current) => ({
      ...current,
      teacherId,
      subject: teacher?.teachingSubject || current.subject || "数学",
    }));
  }

  async function saveLearningLink() {
    setMessage("");
    const method = isEditingLearningLink ? "PATCH" : "POST";
    const response = await fetch("/api/learning-links", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selectedLearningLink,
        courseId: selectedLearningLink.courseId || null,
      }),
    });
    const saved = await response.json();
    if (!response.ok) {
      setMessage(saved.error || "保存学习关系失败");
      return;
    }
    const normalized = {
      id: saved.id,
      workspaceId: saved.workspaceId,
      parentId: saved.parentId,
      studentId: saved.studentId,
      teacherId: saved.teacherId,
      courseId: saved.courseId,
      subject: saved.subject,
      isActive: saved.isActive,
      parentName: saved.parent?.name || "",
      studentName: saved.student?.name || "",
      teacherName: saved.teacher?.name || "",
      courseName: saved.course?.name || null,
    };
    setLearningLinks((current) => isEditingLearningLink
      ? current.map((item) => item.id === normalized.id ? normalized : item)
      : [normalized, ...current]
    );
    setSelectedLearningLink(blankLearningLink);
    setMessage("已保存学习关系");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>所有账号</CardTitle>
            <Button onClick={startCreateAccount} type="button">增加账号</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => editAccount(user)}
                className="w-full rounded-lg border bg-white px-4 py-3 text-left hover:bg-slate-50"
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.phone || user.email || "未设置账号"} · {user.workspaceName}</p>
                    {user.role === "teacher" && (
                      <p className="mt-1 text-xs text-slate-500">教学科目：{user.teachingSubject || "未设置"}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">{roleLabel(user.role)}</span>
                </div>
                {user.role === "parent" && (
                  <p className="mt-2 text-xs text-slate-500">可见学生：{studentNames(students, user.parentStudentIds)}</p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{isEditing ? "编辑账号" : "新增账号"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">姓名</label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">账号</label>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="手机号或登录名" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">邮箱</label>
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">角色</label>
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role, parentStudentIds: role === "parent" ? form.parentStudentIds : [] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="teacher">老师</SelectItem>
                <SelectItem value="parent">家长</SelectItem>
                <SelectItem value="demo">演示</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === "teacher" && (
            <div>
              <label className="text-sm font-medium text-slate-700">教学科目</label>
              <Input value={form.teachingSubject} onChange={(event) => setForm({ ...form, teachingSubject: event.target.value })} placeholder="如：数学" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">工作区</label>
            <Select value={form.workspaceId} onValueChange={(workspaceId) => setForm({ ...form, workspaceId, parentStudentIds: [] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{isEditing ? "重置密码" : "密码"}</label>
            <Input
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={isEditing ? "留空则不修改" : "默认 123456"}
              type="password"
            />
          </div>

          {form.role === "parent" && (
            <div>
              <p className="text-sm font-medium text-slate-700">可见学生</p>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-md border bg-white p-2">
                {visibleStudents.map((student) => (
                  <label key={student.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      checked={form.parentStudentIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      type="checkbox"
                    />
                    <span>{student.name}{student.grade ? ` · ${student.grade}` : ""}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {message && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>}

          <div className="flex gap-2">
            <Button onClick={saveAccount} type="button">保存账号</Button>
            <Button onClick={() => setForm(blankForm)} type="button" variant="outline">取消</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>学习关系</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {learningLinks.length === 0 ? (
              <p className="text-sm text-slate-400">暂无学习关系</p>
            ) : learningLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => editLearningLink(link)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                type="button"
              >
                <p className="font-semibold text-slate-900">{link.studentName} · {link.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{link.parentName} / {link.teacherName}{link.courseName ? ` / ${link.courseName}` : ""}</p>
                <p className="mt-1 text-xs text-slate-400">{link.isActive ? "启用中" : "已停用"}</p>
              </button>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{isEditingLearningLink ? "编辑学习关系" : "新增学习关系"}</p>
            <div>
              <label className="text-sm font-medium text-slate-700">工作区</label>
              <Select value={selectedLearningLink.workspaceId} onValueChange={(workspaceId) => setSelectedLearningLink({ ...blankLearningLink, workspaceId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">家长</label>
              <Select value={selectedLearningLink.parentId} onValueChange={(parentId) => setSelectedLearningLink({ ...selectedLearningLink, parentId })}>
                <SelectTrigger><SelectValue placeholder="选择家长" /></SelectTrigger>
                <SelectContent>
                  {linkParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">学生</label>
              <Select value={selectedLearningLink.studentId} onValueChange={(studentId) => setSelectedLearningLink({ ...selectedLearningLink, studentId })}>
                <SelectTrigger><SelectValue placeholder="选择学生" /></SelectTrigger>
                <SelectContent>
                  {linkStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>{student.name}{student.grade ? ` · ${student.grade}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">老师</label>
              <Select value={selectedLearningLink.teacherId} onValueChange={updateTeacherForLink}>
                <SelectTrigger><SelectValue placeholder="选择老师" /></SelectTrigger>
                <SelectContent>
                  {linkTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}{teacher.teachingSubject ? ` · ${teacher.teachingSubject}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">课程</label>
              <Select value={selectedLearningLink.courseId || "none"} onValueChange={(courseId) => setSelectedLearningLink({ ...selectedLearningLink, courseId: courseId === "none" ? "" : courseId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定课程</SelectItem>
                  {linkCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">科目</label>
              <Input value={selectedLearningLink.subject} onChange={(event) => setSelectedLearningLink({ ...selectedLearningLink, subject: event.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                checked={selectedLearningLink.isActive}
                onChange={(event) => setSelectedLearningLink({ ...selectedLearningLink, isActive: event.target.checked })}
                type="checkbox"
              />
              启用这条学习关系
            </label>
            <div className="flex gap-2">
              <Button onClick={saveLearningLink} type="button">保存学习关系</Button>
              <Button onClick={() => setSelectedLearningLink(blankLearningLink)} type="button" variant="outline">取消</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "管理员";
  if (role === "teacher") return "老师";
  if (role === "demo") return "演示";
  return "家长";
}

function studentNames(students: StudentOption[], ids: string[]) {
  const names = students.filter((student) => ids.includes(student.id)).map((student) => student.name);
  return names.length > 0 ? names.join("、") : "未设置";
}
