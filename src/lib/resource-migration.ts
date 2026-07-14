import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cloneStoredResourceFile,
  createResourceStoredName,
  getStoredResourcePath,
  removeStoredResourceFile,
} from "@/lib/resource-storage";

export type ResourceFileRole = "student" | "answer" | "supplement";

export function inferLegacyFileRole(fileName: string): ResourceFileRole {
  if (/(答案|解析|教师版)/i.test(fileName)) return "answer";
  if (/(学生版|无答案|空白卷)/i.test(fileName)) return "student";
  return "supplement";
}

export type ResourceMigrationResult = {
  legacyCount: number;
  createdGroups: number;
  createdFiles: number;
  copiedCoursePermissions: number;
  copiedUserPermissions: number;
  missingFiles: string[];
};

function legacyTags(keywords: string | null) {
  return Array.from(new Set(
    (keywords || "")
      .split(/[\s,，;；]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  )).slice(0, 10);
}

async function legacySha256(storedName: string, size: number) {
  try {
    const bytes = await readFile(getStoredResourcePath(storedName));
    return { sha256: createHash("sha256").update(bytes).digest("hex"), missing: false };
  } catch {
    const marker = `missing:${storedName}:${size}`;
    return { sha256: createHash("sha256").update(marker).digest("hex"), missing: true };
  }
}

export async function migrateLegacyResources(db: PrismaClient = prisma): Promise<ResourceMigrationResult> {
  await db.resourceFile.updateMany({
    where: { role: "student", primaryRoleKey: null },
    data: { primaryRoleKey: "student" },
  });
  await db.resourceFile.updateMany({
    where: { role: "answer", primaryRoleKey: null },
    data: { primaryRoleKey: "answer" },
  });
  const legacyResources = await db.learningResource.findMany({
    include: {
      coursePermissions: { select: { courseId: true } },
      permissions: { select: { userId: true, canPreview: true, canDownload: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const migrated = await db.legacyResourceMigration.findMany({
    select: { legacyResourceId: true },
  });
  const migratedIds = new Set(migrated.map((item) => item.legacyResourceId).filter(Boolean));
  const result: ResourceMigrationResult = {
    legacyCount: legacyResources.length,
    createdGroups: 0,
    createdFiles: 0,
    copiedCoursePermissions: 0,
    copiedUserPermissions: 0,
    missingFiles: [],
  };

  for (const resource of legacyResources) {
    if (migratedIds.has(resource.id)) continue;
    const hash = await legacySha256(resource.storedName, resource.size);
    if (hash.missing) result.missingFiles.push(resource.fileName);
    const tags = legacyTags(resource.keywords);
    const role = inferLegacyFileRole(resource.fileName);
    const existingGroup = await db.resourceGroup.findUnique({
      where: { legacyResourceId: resource.id },
      include: { files: { orderBy: { orderIndex: "asc" }, take: 1 } },
    });
    const existingFile = existingGroup?.files[0];
    const shouldSeparate = !existingFile || existingFile.storedName === resource.storedName;
    const clonedStoredName = shouldSeparate
      ? hash.missing
        ? createResourceStoredName(resource.extension)
        : await cloneStoredResourceFile(resource.storedName, resource.extension)
      : existingFile?.storedName || resource.storedName;
    let cloneConsumed = false;

    try {
      const created = await db.$transaction(async (tx) => {
        const marker = await tx.legacyResourceMigration.findUnique({
          where: { legacyResourceId: resource.id },
          select: { id: true },
        });
        if (marker) return "skipped" as const;

        const existing = await tx.resourceGroup.findUnique({
          where: { legacyResourceId: resource.id },
          include: { files: { orderBy: { orderIndex: "asc" }, take: 1 } },
        });
        if (existing) {
          if (existing.files[0]) {
            await tx.resourceFile.update({
              where: { id: existing.files[0].id },
              data: {
                storedName: clonedStoredName,
                primaryRoleKey: role === "supplement" ? null : role,
              },
            });
          } else {
            await tx.resourceFile.create({
              data: {
                workspaceId: resource.workspaceId,
                groupId: existing.id,
                originalName: resource.fileName,
                storedName: clonedStoredName,
                mimeType: resource.mimeType,
                extension: resource.extension,
                size: resource.size,
                sha256: hash.sha256,
                role,
                primaryRoleKey: role === "supplement" ? null : role,
                uploadedById: resource.uploadedById,
                createdAt: resource.createdAt,
                updatedAt: resource.updatedAt,
              },
            });
          }
          await tx.legacyResourceMigration.create({
            data: { workspaceId: resource.workspaceId, legacyResourceId: resource.id, groupId: existing.id },
          });
          return "backfilled" as const;
        }

        const group = await tx.resourceGroup.create({
          data: {
            workspaceId: resource.workspaceId,
            legacyResourceId: resource.id,
            title: resource.title,
            description: resource.description,
            subject: resource.subject,
            resourceKind: resource.resourceKind,
            grade: resource.grade,
            totalSize: resource.size,
            infoNeedsReview: hash.missing || role === "supplement",
            createdById: resource.uploadedById,
            createdAt: resource.createdAt,
            updatedAt: resource.updatedAt,
          },
        });
        await tx.resourceFile.create({
          data: {
            workspaceId: resource.workspaceId,
            groupId: group.id,
            originalName: resource.fileName,
            storedName: clonedStoredName,
            mimeType: resource.mimeType,
            extension: resource.extension,
            size: resource.size,
            sha256: hash.sha256,
            role,
            primaryRoleKey: role === "supplement" ? null : role,
            uploadedById: resource.uploadedById,
            createdAt: resource.createdAt,
            updatedAt: resource.updatedAt,
          },
        });

        for (const name of tags) {
          const tag = await tx.resourceTag.upsert({
            where: { workspaceId_name: { workspaceId: resource.workspaceId, name } },
            update: {},
            create: { workspaceId: resource.workspaceId, name },
          });
          await tx.resourceGroupTag.create({ data: { groupId: group.id, tagId: tag.id } });
        }
        if (resource.coursePermissions.length > 0) {
          await tx.resourceGroupCoursePermission.createMany({
            data: resource.coursePermissions.map((permission) => ({
              workspaceId: resource.workspaceId,
              groupId: group.id,
              courseId: permission.courseId,
            })),
          });
        }
        if (resource.permissions.length > 0) {
          await tx.resourceGroupPermission.createMany({
            data: resource.permissions.map((permission) => ({
              workspaceId: resource.workspaceId,
              groupId: group.id,
              userId: permission.userId,
              canPreview: permission.canPreview,
              canDownload: permission.canDownload,
            })),
          });
        }
        await tx.legacyResourceMigration.create({
          data: { workspaceId: resource.workspaceId, legacyResourceId: resource.id, groupId: group.id },
        });
        return "created" as const;
      });
      cloneConsumed = shouldSeparate && created !== "skipped";

      if (created !== "created") continue;
      result.createdGroups += 1;
      result.createdFiles += 1;
      result.copiedCoursePermissions += resource.coursePermissions.length;
      result.copiedUserPermissions += resource.permissions.length;
    } finally {
      if (shouldSeparate && !hash.missing && !cloneConsumed) {
        await removeStoredResourceFile(clonedStoredName).catch(() => undefined);
      }
    }
  }

  return result;
}
