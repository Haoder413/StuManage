import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { deviceAdminService } from "@/lib/device-admin";
import { parseDeviceLimitOverrideInput } from "@/lib/device-admin-input";
import { runDeviceAdminRoute } from "@/lib/device-admin-route-handler";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    notFoundMessage: "账号不存在",
    action: () => deviceAdminService.getAccountDevices(params.id),
  });
  return NextResponse.json(result.body, { status: result.status });
}
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    inputErrorMessage: "请填写 1 至 20 的整数，或留空以使用全局默认值",
    notFoundMessage: "账号不存在",
    action: async (actor) => {
      const input = parseDeviceLimitOverrideInput(await request.json());
      const override = await deviceAdminService.updateAccountOverride(actor, params.id, input);
      return { override };
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
