import { DeviceLimitError, DeviceSessionValidationError, isValidDeviceKey } from "@/lib/device-session";
import { randomBytes } from "node:crypto";

export type WebLoginFailure = {
  status: number;
  body: { error: string; code?: string };
};

export type WebLoginRequest = {
  identifier: string;
  password: string;
  privacyAccepted: true;
};

export function parseWebLoginRequest(data: unknown):
  | { ok: true; value: WebLoginRequest }
  | { ok: false; error: WebLoginFailure } {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: { status: 400, body: { error: "请求内容无效" } } };
  }

  const input = data as Record<string, unknown>;
  if (input.privacyAccepted !== true) {
    return {
      ok: false,
      error: { status: 400, body: { error: "请先阅读并同意设备登录与隐私说明" } },
    };
  }

  const identifier = String(input.identifier || "").trim();
  const password = String(input.password || "");
  if (!identifier || !password) {
    return { ok: false, error: { status: 400, body: { error: "账号和密码不能为空" } } };
  }

  return { ok: true, value: { identifier, password, privacyAccepted: true } };
}

export function webLoginErrorResponse(error: unknown): WebLoginFailure {
  if (error instanceof DeviceLimitError) {
    return { status: 409, body: { error: error.message, code: error.code } };
  }
  if (error instanceof DeviceSessionValidationError) {
    return { status: 400, body: { error: error.message, code: error.code } };
  }
  return { status: 500, body: { error: "登录失败，请稍后重试" } };
}

export function resolveDeviceKey(
  cookieValue: string | null | undefined,
  generate: () => string = () => randomBytes(32).toString("hex"),
): string {
  return isValidDeviceKey(cookieValue) ? cookieValue : generate();
}

export function isSecureRequest(input: { nodeEnv: string | undefined; protocol: string }): boolean {
  return input.nodeEnv === "production" || input.protocol === "https:";
}

export function sessionCookieOptions(secure: boolean, expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires,
  };
}

export function deviceCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  };
}
