import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DeviceAdminNotFoundError, deviceAdminService } from "@/lib/device-admin";
import { DeviceAdminInputError, parseDeviceLimitOverrideInput } from "@/lib/device-admin-input";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  await requireAdmin();
  try {
    return NextResponse.json(await deviceAdminService.getAccountDevices(params.id));
  } catch (error) {
    if (error instanceof DeviceAdminNotFoundError) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }
    throw error;
  }
}
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const actor = await requireAdmin();
  try {
    const input = parseDeviceLimitOverrideInput(await request.json());
    const override = await deviceAdminService.updateAccountOverride(actor, params.id, input);
    return NextResponse.json({ override });
  } catch (error) {
    if (error instanceof DeviceAdminNotFoundError) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }
    if (error instanceof DeviceAdminInputError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "请填写 1 至 20 的整数，或留空以使用全局默认值" }, { status: 400 });
    }
    throw error;
  }
}
