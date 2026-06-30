import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";
import { canManageHomework } from "@/lib/homework-access";
import { convertStoredHomeworkFileToPdf, saveHomeworkFile } from "@/lib/homework-storage";

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export async function GET() {
  const user = await requireTeacherLike();
  const assignments = await prisma.homeworkAssignment.findMany({
    where: { workspaceId: user.workspaceId },
    include: {
      course: true,
      submissions: true,
      questions: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assignments);
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  if (!canManageHomework(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const formData = await request.formData();
  const courseId = String(formData.get("courseId") || "");
  const title = String(formData.get("title") || "").trim();
  const questionFile = formData.get("questionFile");
  const answerFile = formData.get("answerFile");

  if (!courseId || !title || !(questionFile instanceof File) || !(answerFile instanceof File)) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId: user.workspaceId } });
  if (!course) return NextResponse.json({ error: "course not found" }, { status: 404 });

  const [savedQuestionFile, savedAnswerFile] = await Promise.all([
    saveHomeworkFile(questionFile, { allowedFor: "teacher" }),
    saveHomeworkFile(answerFile, { allowedFor: "teacher" }),
  ]);
  const [questionPreview, answerPreview] = await Promise.all([
    convertStoredHomeworkFileToPdf(savedQuestionFile),
    convertStoredHomeworkFileToPdf(savedAnswerFile),
  ]);
  const dueAtText = normalizeText(formData.get("dueAt"));
  const dueAt = dueAtText ? new Date(dueAtText) : null;

  const assignment = await prisma.homeworkAssignment.create({
    data: {
      workspaceId: user.workspaceId,
      courseId,
      createdById: user.id,
      title,
      description: normalizeText(formData.get("description")),
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      status: "draft",
      questionFileName: savedQuestionFile.fileName,
      questionFileStoredName: savedQuestionFile.storedName,
      questionFileMimeType: savedQuestionFile.mimeType,
      questionFileExtension: savedQuestionFile.extension,
      questionFileSize: savedQuestionFile.size,
      questionPreviewStoredName: questionPreview?.storedName || null,
      questionPreviewMimeType: questionPreview?.mimeType || null,
      questionPreviewExtension: questionPreview?.extension || null,
      questionPreviewSize: questionPreview?.size || null,
      answerFileName: savedAnswerFile.fileName,
      answerFileStoredName: savedAnswerFile.storedName,
      answerFileMimeType: savedAnswerFile.mimeType,
      answerFileExtension: savedAnswerFile.extension,
      answerFileSize: savedAnswerFile.size,
      answerPreviewStoredName: answerPreview?.storedName || null,
      answerPreviewMimeType: answerPreview?.mimeType || null,
      answerPreviewExtension: answerPreview?.extension || null,
      answerPreviewSize: answerPreview?.size || null,
      recognitionProvider: "manual",
      recognitionStatus: "manual_required",
      rawRecognitionResult: JSON.stringify({ provider: "manual", notes: ["老师手动填写题型数量生成题目结构。"] }),
    },
    include: { questions: true },
  });

  return NextResponse.json(assignment, { status: 201 });
}
