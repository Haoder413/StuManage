import { NextRequest, NextResponse } from "next/server";
import { requireMobileParent } from "@/lib/mobile-auth";
import { getMobileParentProgress } from "@/lib/mobile-parent-data";

export async function GET(request: NextRequest) {
  const { user, response } = await requireMobileParent(request);
  if (!user) return response;

  return NextResponse.json(await getMobileParentProgress(user));
}
