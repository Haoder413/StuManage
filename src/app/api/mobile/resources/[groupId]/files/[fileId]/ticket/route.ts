import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { requireMobileParent } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { canAccessResourceFile } from "@/lib/resource-group-access";

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string; fileId: string } }
) {
  const { user, response } = await requireMobileParent(request);
  if (!user) return response;
  const file = await prisma.resourceFile.findFirst({
    where: { id: params.fileId, groupId: params.groupId, extension: { in: [".html", ".htm"] } },
  });
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canAccessResourceFile(user, file, "preview")) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.$transaction([
    prisma.mobileResourceTicket.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.mobileResourceTicket.create({
      data: { tokenHash: hashToken(token), userId: user.id, fileId: file.id, expiresAt },
    }),
  ]);
  return NextResponse.json({ url: `/api/mobile/resources/tickets/${token}`, expiresAt });
}
