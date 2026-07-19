import { type AdminApiAuthResult, type AdminApiUser } from "@/lib/admin-api-auth";
import { DeviceAdminInputError } from "@/lib/device-admin-input";
import { DeviceAdminNotFoundError } from "@/lib/device-admin";

type DeviceAdminRouteOptions<T> = {
  authenticate: () => Promise<AdminApiAuthResult>;
  action: (actor: AdminApiUser) => Promise<T>;
  inputErrorMessage?: string;
  notFoundMessage?: string;
};

export async function runDeviceAdminRoute<T>(options: DeviceAdminRouteOptions<T>): Promise<{
  status: number;
  body: T | { error: string };
}> {
  const auth = await options.authenticate();
  if (!auth.ok) return { status: auth.status, body: auth.body };

  try {
    return { status: 200, body: await options.action(auth.user) };
  } catch (error) {
    if (
      options.inputErrorMessage &&
      (error instanceof DeviceAdminInputError || error instanceof SyntaxError)
    ) {
      return { status: 400, body: { error: options.inputErrorMessage } };
    }
    if (options.notFoundMessage && error instanceof DeviceAdminNotFoundError) {
      return { status: 404, body: { error: options.notFoundMessage } };
    }
    throw error;
  }
}
