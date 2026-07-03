import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { getLogoutRedirectPath } from "@/lib/hidden-login-path";

export async function POST() {
  await clearSession();
  return NextResponse.json({ redirectTo: getLogoutRedirectPath() });
}
