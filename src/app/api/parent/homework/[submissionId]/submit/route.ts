import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/auth";
import { findParentVisibleSubmission } from "@/lib/homework-access";
import { saveHomeworkFile } from "@/lib/homework-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const user = await requireParent();
  const submission = await findParentVisibleSubmission({ user, submissionId: params.submissionId });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const saved = await saveHomeworkFile(file, { allowedFor: "parent" });
  const nextVersionNumber = (submission.versions[0]?.versionNumber || 0) + 1;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.homeworkSubmissionVersion.create({
      data: {
        workspaceId: user.workspaceId,
        submissionId: submission.id,
        versionNumber: nextVersionNumber,
        fileName: saved.fileName,
        storedName: saved.storedName,
        mimeType: saved.mimeType,
        extension: saved.extension,
        size: saved.size,
        status: "submitted",
        submittedById: user.id,
      },
    });
    await tx.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: "submitted",
        currentVersionId: created.id,
        totalScore: null,
        overallComment: null,
        gradedById: null,
        gradedAt: null,
      },
    });
    return created;
  });

  return NextResponse.json(version, { status: 201 });
}
