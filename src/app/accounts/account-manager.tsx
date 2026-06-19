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
  workspaceId: string;
  workspaceName: string;
  parentStudentIds: string[];
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

const blankForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  role: "parent",
  workspaceId: "default-real",
  password: "",
  parentStudentIds: [] as string[],
};

export function AccountManager({
  initialUsers,
  workspaces,
  students,
}: {
  initialUsers: Account[];
  workspaces: WorkspaceOption[];
  students: StudentOption[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(blankForm);
  const [message, setMessage] = useState("");
  const isEditing = Boolean(form.id);
  const visibleStudents = useMemo(
    () => students.filter((student) => student.workspaceId === form.workspaceId),
    [students, form.workspaceId]
  );

  function editAccount(account: Account) {
    setMessage("");
    setForm({
      id: account.id,
      name: account.name,
      phone: account.phone || "",
      email: account.email || "",
      role: account.role,
      workspaceId: account.workspaceId,
      password: "",
      parentStudentIds: account.parentStudentIds,
    });
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
      workspaceId: saved.workspaceId,
      workspaceName,
      parentStudentIds: saved.parentStudents?.map((item: { studentId: string }) => item.studentId) || [],
    };
    setUsers((current) => isEditing
      ? current.map((item) => item.id === normalized.id ? normalized : item)
      : [...current, normalized]
    );
    setForm(blankForm);
    setMessage("已保存账号");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader><CardTitle>所有账号</CardTitle></CardHeader>
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
