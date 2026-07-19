import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DeviceAdminNotFoundError, deviceAdminService } from "@/lib/device-admin";

type RouteContext = { params: { id: string; deviceId: string } };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const actor = await requireAdmin();
  try {
    return NextResponse.json(await deviceAdminService.forceLogoutDevice(actor, params.id, params.deviceId));
  } catch (error) {
    if (error instanceof DeviceAdminNotFoundError) {
      return NextResponse.json({ error: "设备不存在或不属于该账号" }, { status: 404 });
    }
    throw error;
  }
}
