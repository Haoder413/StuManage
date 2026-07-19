import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DeviceAdminNotFoundError, deviceAdminService } from "@/lib/device-admin";

type RouteContext = { params: { id: string } };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const actor = await requireAdmin();
  try {
    return NextResponse.json(await deviceAdminService.forceLogoutAll(actor, params.id));
  } catch (error) {
    if (error instanceof DeviceAdminNotFoundError) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }
    throw error;
  }
}
