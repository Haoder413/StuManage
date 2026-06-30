import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/auth";

export async function GET() {
  const user = await requireParent();
  const submissions = await prisma.homeworkSubmission.findMany({
    where: {
      workspaceId: user.workspaceId,
      assignment: { status: "published" },
      student: { parentLinks: { some: { parentId: user.id } } },
    },
    include: {
      student: true,
      assignment: { include: { course: true, questions: { orderBy: { orderIndex: "asc" } } } },
      currentVersion: { include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } } },
      versions: {
        include: { reviews: { include: { question: true }, orderBy: { question: { orderIndex: "asc" } } } },
        orderBy: { versionNumber: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(submissions);
}
