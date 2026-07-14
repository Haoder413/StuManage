import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessResourceFile } from "@/lib/resource-group-access";
import { getStoredResourcePath } from "@/lib/resource-storage";

const HTML_CSP = "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const user = await requireCurrentUser();
  const mode = new URL(request.url).searchParams.get("mode") === "download" ? "download" : "preview";
  const file = await prisma.resourceFile.findFirst({
    where: { id: params.fileId, groupId: params.id },
  });
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canAccessResourceFile(user, file, mode)) {
    return NextResponse.json({ error: "locked" }, { status: 403 });
  }
  try {
    const bytes = await readFile(getStoredResourcePath(file.storedName));
    const headers: Record<string, string> = {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${mode === "download" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
    };
    if (file.extension === ".html" || file.extension === ".htm") {
      headers["Content-Security-Policy"] = HTML_CSP;
      headers["Referrer-Policy"] = "no-referrer";
    }
    return new NextResponse(bytes, { headers });
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 404 });
  }
}
