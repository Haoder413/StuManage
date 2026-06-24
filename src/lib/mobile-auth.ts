import { NextRequest, NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function getMobileBearerToken(request: NextRequest) {
  const header = request.headers.get("Authorization") || request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return "";
  return token.trim();
}

export async function getMobileCurrentUser(request: NextRequest) {
  const token = getMobileBearerToken(request);
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

export async function requireMobileParent(request: NextRequest) {
  const user = await getMobileCurrentUser(request);
  if (!user) return { user: null, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (user.role !== "parent") return { user: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user, response: null };
}
