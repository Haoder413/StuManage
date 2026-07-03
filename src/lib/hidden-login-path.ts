const DEFAULT_HIDDEN_LOGIN_PATH = "/teacher-login-2026";

function normalizeLoginPath(pathname: string) {
  const trimmed = pathname.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");
  return normalized || "/";
}

export function isLoginEnabled() {
  return process.env.LOGIN_ENABLED !== "false";
}

export function getHiddenLoginPath() {
  const configured = process.env.HIDDEN_LOGIN_PATH?.trim();
  if (!configured) return DEFAULT_HIDDEN_LOGIN_PATH;
  const normalized = normalizeLoginPath(configured);
  return normalized.length > 1 ? normalized : DEFAULT_HIDDEN_LOGIN_PATH;
}

export function isHiddenLoginPath(pathname: string) {
  return normalizeLoginPath(pathname) === getHiddenLoginPath();
}

export function isDefaultHiddenLoginPath(pathname: string) {
  return normalizeLoginPath(pathname) === DEFAULT_HIDDEN_LOGIN_PATH;
}
