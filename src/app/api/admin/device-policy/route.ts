import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DeviceAdminInputError, parseDevicePolicyInput } from "@/lib/device-admin-input";
import { deviceAdminService } from "@/lib/device-admin";

export async function GET() {
  await requireAdmin();
  return NextResponse.json(await deviceAdminService.getPolicy());
}
export async function PATCH(request: NextRequest) {
  const actor = await requireAdmin();
  try {
    const input = parseDevicePolicyInput(await request.json());
    return NextResponse.json(await deviceAdminService.updatePolicy(actor, input));
  } catch (error) {
    if (error instanceof DeviceAdminInputError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "请填写 1 至 20 的整数设备上限" }, { status: 400 });
    }
    throw error;
  }
}
