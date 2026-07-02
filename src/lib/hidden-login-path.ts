const DEFAULT_HIDDEN_LOGIN_PATH = "/teacher-login-2026";

export function isLoginEnabled() {
  return process.env.LOGIN_ENABLED !== "false";
}

export function getHiddenLoginPath() {
  const configured = process.env.HIDDEN_LOGIN_PATH?.trim();
  if (!configured) return DEFAULT_HIDDEN_LOGIN_PATH;
  const withLeadingSlash = configured.startsWith("/") ? configured : `/${configured}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : DEFAULT_HIDDEN_LOGIN_PATH;
}

export function isHiddenLoginPath(pathname: string) {
  return pathname === getHiddenLoginPath();
}

export function isDefaultHiddenLoginPath(pathname: string) {
  return pathname === DEFAULT_HIDDEN_LOGIN_PATH;
}
