import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredResourcePath } from "@/lib/resource-storage";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const ticket = await prisma.mobileResourceTicket.findFirst({
    where: { tokenHash: hashToken(params.token), expiresAt: { gt: new Date() } },
    include: { file: true },
  });
  if (!ticket || ![".html", ".htm"].includes(ticket.file.extension)) {
    return NextResponse.json({ error: "ticket_expired" }, { status: 404 });
  }
  try {
    const bytes = await readFile(getStoredResourcePath(ticket.file.storedName));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": ticket.file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(ticket.file.originalName)}`,
        "Content-Security-Policy": "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 404 });
  }
}
