import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTeacherLike } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const currentUser = await requireTeacherLike();
  const data = await request.json();
  const resourceId = String(data.resourceId || "");
  const courseIds = Array.isArray(data.courseIds)
    ? data.courseIds.map((courseId: unknown) => String(courseId)).filter(Boolean)
    : [];

  const resource = await prisma.learningResource.findUnique({ where: { id: resourceId } });
  if (!resource) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (currentUser.role !== "admin" && resource.workspaceId !== currentUser.workspaceId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const courses = await prisma.course.findMany({
    where: {
      id: { in: courseIds },
      workspaceId: resource.workspaceId,
    },
    select: { id: true },
  });

  await prisma.resourceCoursePermission.deleteMany({
    where: { resourceId },
  });

  if (courses.length > 0) {
    await prisma.resourceCoursePermission.createMany({
      data: courses.map((course) => ({
        workspaceId: resource.workspaceId,
        resourceId,
        courseId: course.id,
      })),
    });
  }

  const permissions = await prisma.resourceCoursePermission.findMany({
    where: { resourceId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(permissions);
}

export async function PUT(request: NextRequest) {
  const currentUser = await requireTeacherLike();
  const data = await request.json();
  const resourceId = String(data.resourceId || "");
  const userId = String(data.userId || "");
  const canPreview = Boolean(data.canPreview);
  const canDownload = Boolean(data.canDownload);

  const [resource, user] = await Promise.all([
    prisma.learningResource.findUnique({ where: { id: resourceId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!resource || !user) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (currentUser.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const permission = await prisma.resourcePermission.upsert({
    where: { resourceId_userId: { resourceId, userId } },
    update: { canPreview, canDownload },
    create: {
      workspaceId: resource.workspaceId,
      resourceId,
      userId,
      canPreview,
      canDownload,
    },
  });

  return NextResponse.json(permission);
}
