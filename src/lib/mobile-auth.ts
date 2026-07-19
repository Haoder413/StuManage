import { NextRequest, NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertDeviceSessionScope } from "@/lib/device-session-policy";
import { shouldTouchSession, touchSessionActivity } from "@/lib/device-session";

type MobileSessionUser = {
  id: string;
  name: string;
  role: string;
  workspaceId: string;
  [key: string]: unknown;
};

type MobileSessionRecord = {
  id: string;
  userId: string;
  channel: string | null;
  deviceId: string | null;
  lastSeenAt: Date | null;
  device: { id: string; userId: string; channel: string } | null;
  user: MobileSessionUser;
};

export type MobileAuthDatabase = {
  findSession(tokenHash: string, now: Date): Promise<MobileSessionRecord | null>;
  touchActivity(
    session: { id: string; deviceId: string | null; lastSeenAt: Date | null },
    now: Date,
  ): Promise<unknown>;
};

const prismaMobileAuthDatabase: MobileAuthDatabase = {
  async findSession(tokenHash, now) {
    return prisma.session.findFirst({
      where: {
        tokenHash,
        channel: "miniProgram",
        expiresAt: { gt: now },
        device: { is: { channel: "miniProgram" } },
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

export function getMobileBearerToken(request: NextRequest) {
  const header = request.headers.get("Authorization") || request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return "";
  return token.trim();
}

export async function findMobileCurrentUser(
  token: string,
  database: MobileAuthDatabase = prismaMobileAuthDatabase,
  now = new Date(),
) {
  if (!token) return null;

  const session = await database.findSession(hashToken(token), now);
  if (!session?.device || session.channel !== "miniProgram") return null;
  try {
    assertDeviceSessionScope(session.device, { userId: session.userId, channel: "miniProgram" });
  } catch {
    return null;
  }

  if (shouldTouchSession(session.lastSeenAt, now)) {
    try {
      await database.touchActivity(session, now);
    } catch {
      console.error("Failed to update authenticated mobile session activity");
    }
  }

  return session.user;
}

export async function getMobileCurrentUser(request: NextRequest) {
  return findMobileCurrentUser(getMobileBearerToken(request));
}

export async function requireMobileParent(request: NextRequest) {
  const user = await getMobileCurrentUser(request);
  if (!user) return { user: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (user.role !== "parent") return { user: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user, response: null };
}
