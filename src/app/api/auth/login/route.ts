import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { isLoginEnabled } from "@/lib/hidden-login-path";

function getCookieSecure(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedSsl = request.headers.get("x-forwarded-ssl");
  return forwardedProto === "https" || forwardedSsl === "on";
}

export async function POST(request: NextRequest) {
  if (!isLoginEnabled()) {
    return NextResponse.json({ error: "login_disabled" }, { status: 404 });
  }

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

  const cookieSecure = getCookieSecure(request);
  await createSession(user.id, cookieSecure);
  const redirectTo = user.role === "parent" ? "/parent" : "/dashboard";
  return NextResponse.json({ redirectTo });
}
