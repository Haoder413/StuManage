import { redirect } from "next/navigation";
import LoginPage from "@/app/teacher-login-2026/page";
import { isHiddenLoginPath, isLoginEnabled } from "@/lib/hidden-login-path";

export default function RuntimeHiddenLoginPage({ params }: { params: { path?: string[] } }) {
  const pathname = `/${(params.path || []).join("/")}`;

  if (isLoginEnabled() && isHiddenLoginPath(pathname)) {
    return <LoginPage />;
  }

  redirect("/");
}
