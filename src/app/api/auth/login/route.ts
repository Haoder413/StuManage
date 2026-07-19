import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { DEVICE_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { createDeviceSession, getRequestIp } from "@/lib/device-session";
import { isLoginEnabled } from "@/lib/hidden-login-path";
import {
  deviceCookieOptions,
  parseWebLoginRequest,
  sessionCookieOptions,
  webLoginErrorResponse,
} from "@/lib/web-login";
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
  const parsed = parseWebLoginRequest(data);
  if (!parsed.ok) {
    return NextResponse.json(parsed.error.body, { status: parsed.error.status });
  }
  const { identifier, password, privacyAccepted } = parsed.value;

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
      privacyAccepted,
    });
    const redirectTo = user.role === "parent" ? "/parent" : "/dashboard";
    const response = NextResponse.json({ redirectTo });
    const cookieSecure = getCookieSecure(request);
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(cookieSecure, session.expiresAt));
    response.cookies.set(DEVICE_COOKIE, deviceKey, deviceCookieOptions(cookieSecure));
    return response;
  } catch (error) {
    const failure = webLoginErrorResponse(error);
    if (failure.status === 500) console.error("Failed to create web device session", error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
