import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, ROLE_COOKIE } from "@/lib/auth";

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

  await createSession(user.id);
  cookies().set(ROLE_COOKIE, user.role, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  const redirectTo = user.role === "parent" ? "/parent" : "/";
  return NextResponse.json({ redirectTo });
}
