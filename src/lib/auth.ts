import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logoutDeviceSession, shouldTouchSession, touchSessionActivity } from "@/lib/device-session";
import { assertDeviceSessionScope } from "@/lib/device-session-policy";

export const SESSION_COOKIE = "student_management_session";
export const ROLE_COOKIE = "student_management_role";
export const DEVICE_COOKIE = "student_management_device";
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
    await logoutDeviceSession(hashToken(token));
  }
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ROLE_COOKIE);
}

type WebSessionUser = Prisma.UserGetPayload<{ include: { workspace: true } }>;

type WebSessionRecord = {
  id: string;
  userId: string;
  channel: string | null;
  deviceId: string | null;
  lastSeenAt: Date | null;
  device: { id: string; userId: string; channel: string } | null;
  user: WebSessionUser;
};

export type WebAuthDatabase = {
  findSession(tokenHash: string, now: Date): Promise<WebSessionRecord | null>;
  touchActivity(
    session: { id: string; deviceId: string | null; lastSeenAt: Date | null },
    now: Date,
  ): Promise<unknown>;
};

export function createPrismaWebAuthDatabase(client: typeof prisma): WebAuthDatabase {
  return {
    findSession(tokenHash, now) {
      return client.session.findFirst({
        where: {
          tokenHash,
          channel: "web",
          deviceId: { not: null },
          expiresAt: { gt: now },
          device: { is: { channel: "web" } },
        },
        include: {
          device: { select: { id: true, userId: true, channel: true } },
          user: { include: { workspace: true } },
        },
      });
    },
    touchActivity(session, now) {
      return touchSessionActivity(session, now);
    },
  };
}

const prismaWebAuthDatabase = createPrismaWebAuthDatabase(prisma);

export async function findWebCurrentUser(
  token: string,
  database: WebAuthDatabase = prismaWebAuthDatabase,
  now = new Date(),
) {
  if (!token) return null;

  const session = await database.findSession(hashToken(token), now);
  if (!session?.device || session.channel !== "web" || !session.deviceId) return null;
  try {
    assertDeviceSessionScope(session.device, { userId: session.userId, channel: "web" });
  } catch {
    return null;
  }

  if (shouldTouchSession(session.lastSeenAt, now)) {
    try {
      await database.touchActivity(session, now);
    } catch {
      console.error("Failed to update authenticated web session activity");
    }
  }
  return session.user;
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findWebCurrentUser(token);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
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
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function requireParent() {
  const user = await requireCurrentUser();
  if (user.role !== "parent") redirect("/dashboard");
  return user;
}
