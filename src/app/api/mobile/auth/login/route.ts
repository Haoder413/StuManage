import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const identifier = String(data.identifier || "").trim();
  const password = String(data.password || "");

  if (!identifier || !password) {
    return NextResponse.json({ error: "账号和密码不能为空" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }],
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
  }

  if (user.role !== "parent") {
    return NextResponse.json({ error: "小程序第一版仅支持家长账号" }, { status: 403 });
  }

  const session = await createSessionToken(user.id);
  return NextResponse.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  });
}
