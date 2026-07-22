import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { parseDevicePolicyInput } from "@/lib/device-admin-input";
import { deviceAdminService } from "@/lib/device-admin";
import { runDeviceAdminRoute } from "@/lib/device-admin-route-handler";

export async function GET() {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    action: () => deviceAdminService.getPolicy(),
  });
  return NextResponse.json(result.body, { status: result.status });
}
export async function PATCH(request: NextRequest) {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    inputErrorMessage: "请填写 1 至 20 的整数设备上限",
    action: async (actor) => {
      const input = parseDevicePolicyInput(await request.json());
      return deviceAdminService.updatePolicy(actor, input);
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
