import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileParent } from "@/lib/mobile-auth";
import { convertStoredHomeworkFileToPdf, getStoredHomeworkPath } from "@/lib/homework-storage";
import { extractHomeworkTextFromBuffer } from "@/lib/homework-recognition";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHomeworkDocxPreview(fileName: string, bytes: Buffer) {
  const text = extractHomeworkTextFromBuffer(fileName, bytes).trim();
  const body = text || "这个 Word 文件暂时无法抽取预览文本，请下载原文件查看。";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /></head><body><pre style="white-space:pre-wrap;word-break:break-word;font:16px/1.8 sans-serif;">${escapeHtml(body)}</pre></body></html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { kind: string; id: string } }
) {
  const { user, response } = await requireMobileParent(request);
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  let file: { storedName: string; fileName: string; mimeType: string; extension?: string; previewStoredName?: string | null; previewMimeType?: string | null } | null = null;

  if (params.kind === "question" || params.kind === "answer") {
    const assignment = await prisma.homeworkAssignment.findFirst({
      where: { id: params.id, workspaceId: user.workspaceId },
      include: { submissions: { where: { student: { parentLinks: { some: { parentId: user.id } } } } } },
    });
    if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });

    const parentQuestionAllowed = params.kind === "question" && assignment.status === "published" && assignment.submissions.length > 0;
    const answerDownloadAllowed = params.kind === "answer" && mode === "download" && assignment.status === "published" && assignment.submissions.length > 0;
    if (!parentQuestionAllowed && !answerDownloadAllowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    file = params.kind === "question"
      ? {
          storedName: assignment.questionFileStoredName,
          fileName: assignment.questionFileName,
          mimeType: assignment.questionFileMimeType,
          extension: assignment.questionFileExtension,
          previewStoredName: assignment.questionPreviewStoredName,
          previewMimeType: assignment.questionPreviewMimeType,
        }
      : {
          storedName: assignment.answerFileStoredName,
          fileName: assignment.answerFileName,
          mimeType: assignment.answerFileMimeType,
          extension: assignment.answerFileExtension,
          previewStoredName: assignment.answerPreviewStoredName,
          previewMimeType: assignment.answerPreviewMimeType,
        };
  }

  if (params.kind === "submission") {
    const version = await prisma.homeworkSubmissionVersion.findFirst({
      where: { id: params.id, workspaceId: user.workspaceId },
      include: { submission: { include: { student: { include: { parentLinks: true } } } } },
    });
    if (!version) return NextResponse.json({ error: "not found" }, { status: 404 });
    const parentAllowed = version.submission.student.parentLinks.some((link) => link.parentId === user.id);
    if (!parentAllowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    file = { storedName: version.storedName, fileName: version.fileName, mimeType: version.mimeType, extension: version.extension };
  }

  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (mode === "preview" && file.previewStoredName) {
    const previewBytes = await readFile(getStoredHomeworkPath(file.previewStoredName));
    return new NextResponse(previewBytes, {
      headers: {
        "Content-Type": file.previewMimeType || "application/pdf",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const bytes = await readFile(getStoredHomeworkPath(file.storedName));
  if (mode === "preview" && file.extension && [".doc", ".docx"].includes(file.extension)) {
    const converted = await convertStoredHomeworkFileToPdf({
      fileName: file.fileName,
      storedName: file.storedName,
      extension: file.extension,
    });
    if (converted) {
      const pdfBytes = await readFile(getStoredHomeworkPath(converted.storedName));
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }

  if (mode === "preview" && file.fileName.toLowerCase().endsWith(".docx")) {
    return new NextResponse(renderHomeworkDocxPreview(file.fileName, bytes), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const disposition = mode === "download" ? "attachment" : "inline";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
