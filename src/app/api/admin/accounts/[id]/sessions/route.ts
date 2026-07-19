import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { DeviceAdminNotFoundError, deviceAdminService } from "@/lib/device-admin";

type RouteContext = { params: { id: string } };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  try {
    return NextResponse.json(await deviceAdminService.forceLogoutAll(auth.user, params.id));
  } catch (error) {
    if (error instanceof DeviceAdminNotFoundError) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }
    throw error;
  }
}
