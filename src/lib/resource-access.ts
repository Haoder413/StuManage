import { prisma } from "@/lib/prisma";

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

  const permission = await prisma.resourcePermission.findUnique({
    where: { resourceId_userId: { resourceId: resource.id, userId: user.id } },
  });

  if (!permission) return false;
  return action === "preview" ? permission.canPreview : permission.canDownload;
}
