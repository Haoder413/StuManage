import { NextRequest, NextResponse } from "next/server";
import { requireTeacherLike } from "@/lib/auth";
import {
  suggestResourceNames,
  validateFileNameBatch,
} from "@/lib/deepseek-resource-naming";

export async function POST(request: NextRequest) {
  await requireTeacherLike();
  try {
    const payload = await request.json();
    const fileNames = validateFileNameBatch(payload?.fileNames);
    return NextResponse.json(await suggestResourceNames(fileNames));
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
