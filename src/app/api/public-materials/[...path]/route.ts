import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  getPublicMaterialMimeType,
  getPublicMaterialPath,
  isAllowedPublicMaterialExtension,
} from "@/lib/public-materials";

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const fileName = params.path.join("/");
  const safeName = path.basename(fileName);
  if (!safeName || safeName !== fileName) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const extension = path.extname(safeName).toLowerCase();
  if (!isAllowedPublicMaterialExtension(extension)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const filePath = getPublicMaterialPath(safeName);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const bytes = await readFile(filePath);
  const mode = request.nextUrl.searchParams.get("mode");
  const disposition = mode === "download" ? "attachment" : "inline";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": getPublicMaterialMimeType(extension),
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
