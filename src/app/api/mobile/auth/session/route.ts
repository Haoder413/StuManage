import { NextRequest, NextResponse } from "next/server";
import { getMobileBearerToken, revokeMobileSession } from "@/lib/mobile-auth";

export async function DELETE(request: NextRequest) {
  const token = getMobileBearerToken(request);
  if (token) {
    try {
      await revokeMobileSession(token);
    } catch (error) {
      console.error("Failed to revoke the current mini-program session", error);
      return NextResponse.json({ error: "退出失败，请稍后重试" }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}
