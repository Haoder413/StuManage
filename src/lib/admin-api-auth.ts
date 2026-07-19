import { getCurrentUser } from "@/lib/auth";

export type AdminApiUser = { id: string; name: string; role: string };
export type AdminApiAuthResult =
  | { ok: true; user: AdminApiUser }
  | { ok: false; status: 401 | 403; body: { error: string } };

export async function requireAdminApi(
  loadCurrentUser: () => Promise<AdminApiUser | null> = getCurrentUser,
): Promise<AdminApiAuthResult> {
  const user = await loadCurrentUser();
  if (!user) {
    return { ok: false, status: 401, body: { error: "请先登录" } };
  }
  if (user.role !== "admin") {
    return { ok: false, status: 403, body: { error: "无管理员权限" } };
  }
  return { ok: true, user };
}
