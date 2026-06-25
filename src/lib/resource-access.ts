import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function canManageResources(user: { role: string }) {
  return user.role === "admin" || user.role === "teacher";
}

export function isResourceControlledRole(user: { role: string }) {
  return user.role === "parent" || user.role === "demo";
}

export async function canAccessResource(
  user: { id: string; role: string; workspaceId: string },
  resource: { id: string; workspaceId: string },
  action: "preview" | "download"
) {
  if (canManageResources(user)) return true;
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
  if (canManageResources(user)) {
    return { workspaceId: user.workspaceId };
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
