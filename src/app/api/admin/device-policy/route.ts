import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-auth";
import { DeviceAdminInputError, parseDevicePolicyInput } from "@/lib/device-admin-input";
import { deviceAdminService } from "@/lib/device-admin";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  return NextResponse.json(await deviceAdminService.getPolicy());
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  try {
    const input = parseDevicePolicyInput(await request.json());
    return NextResponse.json(await deviceAdminService.updatePolicy(auth.user, input));
  } catch (error) {
    if (error instanceof DeviceAdminInputError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "请填写 1 至 20 的整数设备上限" }, { status: 400 });
    }
    throw error;
  }
}
