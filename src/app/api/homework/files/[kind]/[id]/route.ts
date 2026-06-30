import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canManageHomework } from "@/lib/homework-access";
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
  const body = text
    ? escapeHtml(text)
    : "这个 Word 文件暂时无法抽取预览文本，请点击下载查看原文件。";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2937; background: #fff; line-height: 1.8; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; font: inherit; }
  </style>
</head>
<body><pre>${body}</pre></body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { kind: string; id: string } }
) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  let file: { storedName: string; fileName: string; mimeType: string; extension?: string; previewStoredName?: string | null; previewMimeType?: string | null } | null = null;

  if (params.kind === "question" || params.kind === "answer") {
    const assignment = await prisma.homeworkAssignment.findFirst({
      where: { id: params.id },
      include: { submissions: { where: { student: { parentLinks: { some: { parentId: user.id } } } } } },
    });
    if (!assignment) return NextResponse.json({ error: "not found" }, { status: 404 });
    const teacherAllowed = canManageHomework(user) && assignment.workspaceId === user.workspaceId;
    const parentQuestionAllowed = params.kind === "question" && assignment.status === "published" && assignment.workspaceId === user.workspaceId && assignment.submissions.length > 0;
    const answerDownloadAllowed = params.kind === "answer" && mode === "download" && assignment.status === "published" && assignment.workspaceId === user.workspaceId && assignment.submissions.length > 0;
    if (!teacherAllowed && !parentQuestionAllowed && !answerDownloadAllowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
      where: { id: params.id },
      include: { submission: { include: { student: { include: { parentLinks: true } } } } },
    });
    if (!version) return NextResponse.json({ error: "not found" }, { status: 404 });
    const teacherAllowed = canManageHomework(user) && version.workspaceId === user.workspaceId;
    const parentAllowed = version.workspaceId === user.workspaceId && version.submission.student.parentLinks.some((link) => link.parentId === user.id);
    if (!teacherAllowed && !parentAllowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
