import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { teacherSeesAllWorkspaceData, visibleCourseWhere } from "@/lib/teacher-visibility";

export function canManageResources(user: { role: string }) {
  return user.role === "admin" || user.role === "teacher" || user.role === "demo";
}

export function isResourceControlledRole(user: { role: string }) {
  return user.role === "parent";
}

export async function canAccessResource(
  user: { id: string; role: string; workspaceId: string },
  resource: { id: string; workspaceId: string },
  action: "preview" | "download"
) {
  if (user.role === "admin") return true;
  if (user.role === "demo") return resource.workspaceId === user.workspaceId;
  if (user.role === "teacher") {
    const visible = await prisma.learningResource.findFirst({
      where: { id: resource.id, ...getVisibleResourceWhere(user) },
      select: { id: true },
    });
    return Boolean(visible);
  }
  if (!isResourceControlledRole(user)) return false;

  const directPermission = await prisma.resourcePermission.findFirst({
    where: {
      resourceId: resource.id,
      userId: user.id,
      workspaceId: resource.workspaceId,
    },
    select: { canPreview: true, canDownload: true },
  });
  if (directPermission) {
    return action === "download"
      ? directPermission.canDownload
      : directPermission.canPreview || directPermission.canDownload;
  }

  const coursePermission = await prisma.resourceCoursePermission.findFirst({
    where: {
      resourceId: resource.id,
      workspaceId: resource.workspaceId,
      course: {
        learningLinks: {
          some: {
            workspaceId: user.workspaceId,
            parentId: user.id,
            isActive: true,
          },
        },
      },
    },
  });

  return Boolean(coursePermission);
}

export function getVisibleResourceWhere(user: { id: string; role: string; workspaceId: string }): Prisma.LearningResourceWhereInput {
  if (user.role === "admin") {
    return {};
  }

  if (teacherSeesAllWorkspaceData(user)) {
    return { workspaceId: user.workspaceId };
  }

  if (user.role === "teacher") {
    return {
      workspaceId: user.workspaceId,
      OR: [
        { uploadedById: user.id },
        {
          coursePermissions: {
            some: {
              course: visibleCourseWhere(user),
            },
          },
        },
      ],
    };
  }

  if (!isResourceControlledRole(user)) {
    return { id: "__no_access__" };
  }

  return {
    workspaceId: user.workspaceId,
    OR: [
      {
        permissions: {
          some: {
            userId: user.id,
            workspaceId: user.workspaceId,
            OR: [{ canPreview: true }, { canDownload: true }],
          },
        },
      },
      {
        coursePermissions: {
          some: {
            course: {
              learningLinks: {
                some: {
                  workspaceId: user.workspaceId,
                  parentId: user.id,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    ],
  };
}
