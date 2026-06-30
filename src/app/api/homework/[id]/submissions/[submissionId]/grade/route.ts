import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

type ReviewInput = {
  questionId?: string;
  score?: number | string;
  comment?: string;
  isCorrect?: boolean;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; submissionId: string } }
) {
  const user = await requireTeacherLike();
  const body = await request.json();
  const submission = await prisma.homeworkSubmission.findFirst({
    where: {
      id: params.submissionId,
      assignmentId: params.id,
      workspaceId: user.workspaceId,
    },
    include: {
      currentVersion: true,
      assignment: { include: { questions: true } },
    },
  });
  if (!submission) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!submission.currentVersion) return NextResponse.json({ error: "no submitted version" }, { status: 400 });

  const reviews = Array.isArray(body.reviews) ? body.reviews as ReviewInput[] : [];
  const questionIds = new Set(submission.assignment.questions.map((question) => question.id));
  const normalizedReviews = reviews
    .filter((review) => review.questionId && questionIds.has(review.questionId))
    .map((review) => ({
      questionId: String(review.questionId),
      score: Number(review.score || 0),
      comment: String(review.comment || "").trim() || null,
      isCorrect: Boolean(review.isCorrect),
    }));
  const totalScore = normalizedReviews.reduce((sum, review) => sum + review.score, 0);
  const overallComment = String(body.overallComment || "").trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.homeworkQuestionReview.deleteMany({
      where: { workspaceId: user.workspaceId, submissionVersionId: submission.currentVersionId || "" },
    });
    for (const review of normalizedReviews) {
      await tx.homeworkQuestionReview.create({
        data: {
          workspaceId: user.workspaceId,
          submissionVersionId: submission.currentVersion!.id,
          questionId: review.questionId,
          score: review.score,
          comment: review.comment,
          isCorrect: review.isCorrect,
        },
      });
    }
    await tx.homeworkSubmissionVersion.update({
      where: { id: submission.currentVersion!.id },
      data: {
        status: "graded",
        gradedById: user.id,
        gradedAt: new Date(),
        totalScore,
        overallComment,
      },
    });
    await tx.homeworkSubmission.update({
      where: { id: submission.id },
      data: {
        status: "graded",
        totalScore,
        overallComment,
        gradedById: user.id,
        gradedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true, totalScore });
}
