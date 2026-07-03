import { redirect } from "next/navigation";
import { LoginPageClient } from "@/components/login-page-client";
import { isHiddenLoginPath, isLoginEnabled } from "@/lib/hidden-login-path";

export default function RuntimeHiddenLoginPage({ params }: { params: { path?: string[] } }) {
  const pathname = `/${(params.path || []).join("/")}`;

  if (isLoginEnabled() && isHiddenLoginPath(pathname)) {
    return <LoginPageClient />;
  }

  redirect("/");
}
