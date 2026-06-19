import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canAccessResource } from "@/lib/resource-access";
import { getStoredResourcePath } from "@/lib/resource-storage";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  const resource = await prisma.learningResource.findFirst({
    where: { id: params.id },
  });

  if (!resource) return NextResponse.json({ error: "not found" }, { status: 404 });

  const allowed = await canAccessResource(user, resource, mode);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const bytes = await readFile(getStoredResourcePath(resource.storedName));
  const disposition = mode === "download" ? "attachment" : "inline";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": resource.mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
