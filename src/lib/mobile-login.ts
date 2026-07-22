import { randomBytes } from "node:crypto";
import {
  CreateDeviceSessionInput,
  DeviceLimitError,
  DeviceSessionValidationError,
  isValidDeviceKey,
} from "@/lib/device-session";
import { DeviceType } from "@/lib/device-session-policy";

type MobileLoginUser = {
  id: string;
  name: string;
  role: string;
  passwordHash: string;
};

export type MobileLoginFailure = {
  status: number;
  body: Record<string, unknown> & { error: string };
};

export type MobileLoginRequest = {
  identifier: string;
  password: string;
  privacyAccepted: true;
  deviceKey?: string;
  deviceType: DeviceType;
  displayName?: string;
  operatingSystem?: string;
  clientVersion?: string;
};

export type MobileLoginDependencies = {
  findUser(identifier: string): Promise<MobileLoginUser | null>;
  verifyLoginPassword(password: string, user: MobileLoginUser | null): boolean;
  createDeviceSession(userId: string, input: CreateDeviceSessionInput): Promise<{ token: string; expiresAt: Date }>;
  generateDeviceKey(): string;
};

export function parseMobileLoginRequest(data: unknown):
  | { ok: true; value: MobileLoginRequest }
  | { ok: false; error: MobileLoginFailure } {
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

  const deviceType: DeviceType =
    input.deviceType === "tablet" || input.deviceType === "desktop" ? input.deviceType : "mobile";
  return {
    ok: true,
    value: {
      identifier,
      password,
      privacyAccepted: true,
      deviceKey: typeof input.deviceKey === "string" ? input.deviceKey : undefined,
      deviceType,
      displayName: typeof input.displayName === "string" ? input.displayName : undefined,
      operatingSystem: typeof input.operatingSystem === "string" ? input.operatingSystem : undefined,
      clientVersion: typeof input.clientVersion === "string" ? input.clientVersion : undefined,
    },
  };
}

export function resolveMiniDeviceKey(
  value: unknown,
  generate: () => string = () => randomBytes(32).toString("hex"),
): { deviceKey: string; replaced: boolean } {
  if (isValidDeviceKey(value)) return { deviceKey: value, replaced: false };
  const deviceKey = generate();
  if (!isValidDeviceKey(deviceKey)) throw new Error("Generated mini-program device key is invalid");
  return { deviceKey, replaced: true };
}

export function mobileLoginErrorResponse(error: unknown): MobileLoginFailure {
  if (error instanceof DeviceLimitError) {
    return { status: 409, body: { error: error.message, code: error.code } };
  }
  if (error instanceof DeviceSessionValidationError) {
    return { status: 400, body: { error: error.message, code: error.code } };
  }
  return { status: 500, body: { error: "登录失败，请稍后重试" } };
}

export async function executeMobileLogin(
  data: unknown,
  requestInfo: { userAgent?: string; ipAddress?: string },
  dependencies: MobileLoginDependencies,
): Promise<{ status: number; body: Record<string, any> }> {
  const parsed = parseMobileLoginRequest(data);
  if (!parsed.ok) return parsed.error;

  const input = parsed.value;
  const user = await dependencies.findUser(input.identifier);
  if (!dependencies.verifyLoginPassword(input.password, user) || !user) {
    return { status: 401, body: { error: "账号或密码不正确" } };
  }
  if (user.role !== "parent") {
    return { status: 403, body: { error: "小程序第一版仅支持家长账号" } };
  }

  const { deviceKey } = resolveMiniDeviceKey(input.deviceKey, dependencies.generateDeviceKey);
  try {
    const session = await dependencies.createDeviceSession(user.id, {
      channel: "miniProgram",
      deviceKey,
      deviceType: input.deviceType,
      displayName: input.displayName,
      operatingSystem: input.operatingSystem,
      clientVersion: input.clientVersion,
      userAgent: requestInfo.userAgent,
      ipAddress: requestInfo.ipAddress,
      privacyAccepted: true,
    });
    return {
      status: 200,
      body: {
        token: session.token,
        expiresAt: session.expiresAt,
        deviceKey,
        user: { id: user.id, name: user.name, role: user.role },
      },
    };
  } catch (error) {
    return mobileLoginErrorResponse(error);
  }
}
