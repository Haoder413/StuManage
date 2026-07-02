import { NextRequest, NextResponse } from "next/server";
import { isDefaultHiddenLoginPath, isHiddenLoginPath, isLoginEnabled } from "@/lib/hidden-login-path";

const SESSION_COOKIE = "student_management_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isPublicHome = pathname === "/";
  const isPublicMaterials = pathname.startsWith("/materials");
  const isHiddenLogin = isHiddenLoginPath(pathname);
  const isDisclaimer = pathname.startsWith("/disclaimer");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/);

  if (!isLoginEnabled() && isHiddenLogin) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (isHiddenLogin && !isDefaultHiddenLoginPath(pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/teacher-login-2026";
    return NextResponse.rewrite(rewriteUrl);
  }

  if (isAuthRoute || isPublicHome || isPublicMaterials || isHiddenLogin || isDisclaimer || isPublicAsset) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = "/";
  homeUrl.search = "";
  return NextResponse.redirect(homeUrl);
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
