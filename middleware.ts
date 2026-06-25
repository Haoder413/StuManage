import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "student_management_session";
const ROLE_COOKIE = "student_management_role";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isLogin = pathname.startsWith("/login");
  const isDisclaimer = pathname.startsWith("/disclaimer");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/);

  if (isAuthRoute || isLogin || isDisclaimer || isPublicAsset) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    const role = request.cookies.get(ROLE_COOKIE)?.value;
    if (role === "parent" && !pathname.startsWith("/parent") && !pathname.startsWith("/api/auth")) {
      const parentUrl = request.nextUrl.clone();
      parentUrl.pathname = "/parent";
      parentUrl.search = "";
      return NextResponse.redirect(parentUrl);
    }
    if ((role === "admin" || role === "teacher" || role === "demo") && pathname.startsWith("/parent")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
