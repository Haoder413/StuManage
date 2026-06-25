import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "student_management_session";
export const ROLE_COOKIE = "student_management_role";
const SESSION_DAYS = 14;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSessionToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function createSession(userId: string, cookieSecure?: boolean) {
  const { token, expiresAt } = await createSessionToken(userId);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(cookieSecure),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ROLE_COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() },
    },
    include: { user: { include: { workspace: true } } },
  });

  return session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCurrentWorkspaceId() {
  const user = await requireCurrentUser();
  return user.workspaceId;
}

export async function requireTeacherLike() {
  const user = await requireCurrentUser();
  if (user.role !== "admin" && user.role !== "teacher" && user.role !== "demo") redirect("/parent");
  return user;
}

export async function requireAdmin() {
  const user = await requireCurrentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function requireParent() {
  const user = await requireCurrentUser();
  if (user.role !== "parent") redirect("/");
  return user;
}
