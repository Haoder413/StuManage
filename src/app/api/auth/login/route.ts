import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { DEVICE_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import {
  DeviceLimitError,
  DeviceSessionValidationError,
  createDeviceSession,
  getRequestIp,
} from "@/lib/device-session";
import { isLoginEnabled } from "@/lib/hidden-login-path";
import { randomBytes } from "node:crypto";

function getCookieSecure(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedSsl = request.headers.get("x-forwarded-ssl");
  return request.nextUrl.protocol === "https:" || forwardedProto === "https" || forwardedSsl === "on";
}

export async function POST(request: NextRequest) {
  if (!isLoginEnabled()) {
    return NextResponse.json({ error: "login_disabled" }, { status: 404 });
  }

  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "请求内容无效" }, { status: 400 });
  }
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

  const deviceKey = request.cookies.get(DEVICE_COOKIE)?.value ?? randomBytes(32).toString("hex");

  try {
    const session = await createDeviceSession(user.id, {
      channel: "web",
      deviceKey,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: getRequestIp(request.headers) ?? undefined,
      privacyAccepted: data.privacyAccepted === true,
    });
    const redirectTo = user.role === "parent" ? "/parent" : "/dashboard";
    const response = NextResponse.json({ redirectTo });
    const cookieSecure = getCookieSecure(request);
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      expires: session.expiresAt,
    });
    response.cookies.set(DEVICE_COOKIE, deviceKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof DeviceLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    if (error instanceof DeviceSessionValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Failed to create web device session", error);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
