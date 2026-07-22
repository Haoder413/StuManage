import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { deviceAdminService } from "@/lib/device-admin";
import { runDeviceAdminRoute } from "@/lib/device-admin-route-handler";

type RouteContext = { params: { id: string; deviceId: string } };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    notFoundMessage: "设备不存在或不属于该账号",
    action: (actor) => deviceAdminService.forceLogoutDevice(actor, params.id, params.deviceId),
  });
  return NextResponse.json(result.body, { status: result.status });
}
