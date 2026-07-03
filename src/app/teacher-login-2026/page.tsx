import { redirect } from "next/navigation";
import { LoginPageClient } from "@/components/login-page-client";
import { isHiddenLoginPath, isLoginEnabled } from "@/lib/hidden-login-path";

export default function LoginPage() {
  if (!isLoginEnabled() || !isHiddenLoginPath("/teacher-login-2026")) {
    redirect("/");
  }

  return <LoginPageClient />;
}
