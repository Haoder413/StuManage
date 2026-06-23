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
  _action: "preview" | "download"
) {
  if (canManageResources(user)) return true;
  if (!isResourceControlledRole(user)) return false;

  const permission = await prisma.resourceCoursePermission.findFirst({
    where: {
      resourceId: resource.id,
      workspaceId: resource.workspaceId,
      course: {
        studentCourses: {
          some: {
            student: {
              parentLinks: {
                some: { parentId: user.id },
              },
            },
          },
        },
      },
    },
  });

  return Boolean(permission);
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
    coursePermissions: {
      some: {
        course: {
          studentCourses: {
            some: {
              student: {
                parentLinks: {
                  some: { parentId: user.id },
                },
              },
            },
          },
        },
      },
    },
  };
}
