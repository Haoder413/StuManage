import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { deviceAdminService } from "@/lib/device-admin";
import { runDeviceAdminRoute } from "@/lib/device-admin-route-handler";

type RouteContext = { params: { id: string } };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const result = await runDeviceAdminRoute({
    authenticate: requireAdminApi,
    notFoundMessage: "账号不存在",
    action: (actor) => deviceAdminService.forceLogoutAll(actor, params.id),
  });
  return NextResponse.json(result.body, { status: result.status });
}
