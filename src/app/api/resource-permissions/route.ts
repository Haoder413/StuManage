import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await requireAdmin();
  const data = await request.json();
  const resourceId = String(data.resourceId || "");
  const userId = String(data.userId || "");
  const canPreview = Boolean(data.canPreview);
  const canDownload = Boolean(data.canDownload);

  const [resource, user] = await Promise.all([
    prisma.learningResource.findUnique({ where: { id: resourceId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!resource || !user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const permission = await prisma.resourcePermission.upsert({
    where: { resourceId_userId: { resourceId, userId } },
    update: { canPreview, canDownload },
    create: {
      workspaceId: resource.workspaceId,
      resourceId,
      userId,
      canPreview,
      canDownload,
    },
  });

  return NextResponse.json(permission);
}
