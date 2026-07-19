import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLoginPassword } from "@/lib/password";
import { createDeviceSession, getRequestIp } from "@/lib/device-session";
import { executeMobileLogin } from "@/lib/mobile-login";
import { randomBytes } from "node:crypto";

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => null);
  try {
    const result = await executeMobileLogin(
      data,
      {
        userAgent: request.headers.get("user-agent") || "WeChat Mini Program",
        ipAddress: getRequestIp(request.headers) ?? undefined,
      },
      {
        findUser: (identifier) => prisma.user.findFirst({
          where: { OR: [{ phone: identifier }, { email: identifier }] },
        }),
        verifyLoginPassword,
        createDeviceSession,
        generateDeviceKey: () => randomBytes(32).toString("hex"),
      },
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Failed to process mini-program login", error);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
