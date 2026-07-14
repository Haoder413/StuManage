import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { teacherSeesAllWorkspaceData, visibleCourseWhere } from "@/lib/teacher-visibility";

export type ResourceGroupUser = {
  id: string;
  role: string;
  workspaceId: string;
};

export function canManageResourceGroups(user: Pick<ResourceGroupUser, "role">) {
  return user.role === "admin" || user.role === "teacher" || user.role === "demo";
}

export function getManageableResourceGroupWhere(user: ResourceGroupUser): Prisma.ResourceGroupWhereInput {
  if (user.role === "admin") return {};
  if (user.role === "demo") return { workspaceId: user.workspaceId };
  if (user.role === "teacher") return { workspaceId: user.workspaceId, createdById: user.id };
  return { id: "__no_access__" };
}

export function resolveParentResourcePermissions(
  direct: { canPreview: boolean; canDownload: boolean } | undefined,
  hasCourseAccess: boolean
) {
  return {
    canPreview: hasCourseAccess || Boolean(direct?.canPreview || direct?.canDownload),
    canDownload: hasCourseAccess || Boolean(direct?.canDownload),
  };
}

export function getVisibleResourceGroupWhere(user: ResourceGroupUser): Prisma.ResourceGroupWhereInput {
  if (user.role === "admin") return {};
  if (teacherSeesAllWorkspaceData(user)) return { workspaceId: user.workspaceId };
  if (user.role === "teacher") {
    return {
      workspaceId: user.workspaceId,
      OR: [
        { createdById: user.id },
        { coursePermissions: { some: { course: visibleCourseWhere(user) } } },
      ],
    };
  }
  if (user.role !== "parent") return { id: "__no_access__" };
  return {
    workspaceId: user.workspaceId,
    OR: [
      { permissions: { some: {
        userId: user.id,
        workspaceId: user.workspaceId,
        OR: [{ canPreview: true }, { canDownload: true }],
      } } },
      { coursePermissions: { some: { course: { learningLinks: { some: {
        workspaceId: user.workspaceId,
        parentId: user.id,
        isActive: true,
      } } } } } },
    ],
  };
}

export async function canAccessResourceFile(
  user: ResourceGroupUser,
  file: { id: string; workspaceId: string; groupId: string },
  action: "preview" | "download"
) {
  if (user.role === "admin") return true;
  if (canManageResourceGroups(user)) {
    const visible = await prisma.resourceFile.findFirst({
      where: { id: file.id, group: getVisibleResourceGroupWhere(user) },
      select: { id: true },
    });
    return Boolean(visible);
  }
  if (user.role !== "parent" || file.workspaceId !== user.workspaceId) return false;

  const permissionCondition = action === "download"
    ? { canDownload: true }
    : { OR: [{ canPreview: true }, { canDownload: true }] };
  const visible = await prisma.resourceFile.findFirst({
    where: {
      id: file.id,
      workspaceId: user.workspaceId,
      group: {
        OR: [
          { permissions: { some: {
            userId: user.id,
            workspaceId: user.workspaceId,
            ...permissionCondition,
          } } },
          { coursePermissions: { some: { course: { learningLinks: { some: {
            workspaceId: user.workspaceId,
            parentId: user.id,
            isActive: true,
          } } } } } },
        ],
      },
    },
    select: { id: true },
  });
  return Boolean(visible);
}
