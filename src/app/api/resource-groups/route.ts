import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, requireTeacherLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleResourceGroupWhere, resolveParentResourcePermissions } from "@/lib/resource-group-access";
import {
  parseResourceGroupManifest,
  parseResourceGroupQuery,
  validateUploadBatch,
} from "@/lib/resource-library-validation";
import {
  commitStagedResourceFile,
  removeStagedResourceFile,
  removeStoredResourceFile,
  stageUploadedResourceFile,
  type StagedResourceFile,
} from "@/lib/resource-storage";
import { visibleCourseWhere } from "@/lib/teacher-visibility";

function fileStateWhere(fileState: ReturnType<typeof parseResourceGroupQuery>["fileState"]): Prisma.ResourceGroupWhereInput | null {
  if (fileState === "student") return { files: { some: { role: "student" } } };
  if (fileState === "answer") return { files: { some: { role: "answer" } } };
  if (fileState === "complete") {
    return { AND: [{ files: { some: { role: "student" } } }, { files: { some: { role: "answer" } } }] };
  }
  if (fileState === "incomplete") {
    return { OR: [{ files: { none: { role: "student" } } }, { files: { none: { role: "answer" } } }] };
  }
  return null;
}

function groupOrderBy(sort: ReturnType<typeof parseResourceGroupQuery>["sort"]): Prisma.ResourceGroupOrderByWithRelationInput {
  if (sort === "created") return { createdAt: "desc" };
  if (sort === "title") return { title: "asc" };
  if (sort === "grade") return { grade: "asc" };
  if (sort === "size") return { totalSize: "desc" };
  return { updatedAt: "desc" };
}

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser();
  const query = parseResourceGroupQuery(new URL(request.url).searchParams);
  const conditions: Prisma.ResourceGroupWhereInput[] = [getVisibleResourceGroupWhere(user)];
  const workspaceId = user.role === "admin" ? query.workspaceId : user.workspaceId;
  if (workspaceId) conditions.push({ workspaceId });
  if (query.grade) conditions.push({ grade: query.grade });
  if (query.subject) conditions.push({ subject: query.subject });
  if (query.resourceKind) conditions.push({ resourceKind: query.resourceKind });
  if (query.courseId) conditions.push({ coursePermissions: { some: { courseId: query.courseId } } });
  const stateWhere = fileStateWhere(query.fileState);
  if (stateWhere) conditions.push(stateWhere);
  if (query.q) {
    conditions.push({ OR: [
      { title: { contains: query.q } },
      { description: { contains: query.q } },
      { grade: { contains: query.q } },
      { subject: { contains: query.q } },
      { files: { some: { originalName: { contains: query.q } } } },
      { tags: { some: { tag: { name: { contains: query.q } } } } },
    ] });
  }
  const where: Prisma.ResourceGroupWhereInput = { AND: conditions };
  const parentLinkWhere = user.role === "parent"
    ? { workspaceId: user.workspaceId, parentId: user.id, isActive: true }
    : { id: "__not_needed__" };
  const [total, groups] = await prisma.$transaction([
    prisma.resourceGroup.count({ where }),
    prisma.resourceGroup.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        files: { orderBy: [{ role: "asc" }, { orderIndex: "asc" }] },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        permissions: { where: { userId: user.id }, select: { canPreview: true, canDownload: true } },
        coursePermissions: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                learningLinks: { where: parentLinkWhere, select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: [groupOrderBy(query.sort), { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const items = groups.map((group) => {
    const direct = group.permissions[0];
    const parentHasCourseAccess = group.coursePermissions.some((permission) => permission.course.learningLinks.length > 0);
    const files = group.files.map((file) => {
      const parentPermissions = resolveParentResourcePermissions(direct, parentHasCourseAccess);
      const canPreview = user.role !== "parent" || parentPermissions.canPreview;
      const canDownload = user.role !== "parent" || parentPermissions.canDownload;
      return {
        id: file.id,
        originalName: file.originalName,
        extension: file.extension,
        mimeType: file.mimeType,
        size: file.size,
        role: file.role,
        createdAt: file.createdAt,
        canPreview,
        canDownload,
      };
    });
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      grade: group.grade,
      subject: group.subject,
      resourceKind: group.resourceKind,
      totalSize: group.totalSize,
      infoNeedsReview: group.infoNeedsReview,
      workspaceId: group.workspaceId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      createdByName: group.createdBy.name,
      canManage: user.role === "admin" || user.role === "demo" || (user.role === "teacher" && group.createdById === user.id),
      tags: group.tags.map((relation) => relation.tag),
      courses: group.coursePermissions
        .filter((permission) => user.role !== "parent" || permission.course.learningLinks.length > 0)
        .map((permission) => ({ id: permission.course.id, name: permission.course.name })),
      files,
    };
  });
  return NextResponse.json({
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasNextPage: query.page * query.pageSize < total,
  });
}

async function cleanupStaged(stagedFiles: StagedResourceFile[]) {
  await Promise.all(stagedFiles.map((staged) => removeStagedResourceFile(staged).catch(() => undefined)));
}

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  const stagedFiles: StagedResourceFile[] = [];
  const committedNames: string[] = [];
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    validateUploadBatch(files);
    const manifest = parseResourceGroupManifest(String(formData.get("manifest") || ""), files.length);
    const workspaceId = user.role === "admin"
      ? String(formData.get("workspaceId") || user.workspaceId)
      : user.workspaceId;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    if (!workspace) throw new Error("invalid_workspace");

    const requestedCourseIds = Array.from(new Set(manifest.groups.flatMap((group) => group.courseIds)));
    const courses = requestedCourseIds.length > 0
      ? await prisma.course.findMany({
          where: user.role === "admin"
            ? { id: { in: requestedCourseIds }, workspaceId }
            : { id: { in: requestedCourseIds }, ...visibleCourseWhere(user), workspaceId },
          select: { id: true },
        })
      : [];
    if (courses.length !== requestedCourseIds.length) throw new Error("invalid_course_ids");

    for (const file of files) stagedFiles.push(await stageUploadedResourceFile(file));
    const duplicates = await prisma.resourceFile.findMany({
      where: { workspaceId, sha256: { in: stagedFiles.map((file) => file.sha256) } },
      select: { sha256: true, originalName: true },
    });
    const duplicateHashes = new Set(duplicates.map((file) => file.sha256));
    for (const group of manifest.groups) {
      for (const entry of group.files) {
        if (duplicateHashes.has(stagedFiles[entry.fileIndex].sha256) && !entry.confirmDuplicate) {
          throw new Error(`duplicate_file:${files[entry.fileIndex].name}`);
        }
      }
    }

    for (const staged of stagedFiles) {
      await commitStagedResourceFile(staged);
      committedNames.push(staged.storedName);
    }

    const createdIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const groupInput of manifest.groups) {
        const group = await tx.resourceGroup.create({
          data: {
            workspaceId,
            title: groupInput.title,
            description: groupInput.description,
            grade: groupInput.grade,
            subject: groupInput.subject || user.teachingSubject,
            resourceKind: groupInput.resourceKind,
            totalSize: groupInput.files.reduce((sum, entry) => sum + stagedFiles[entry.fileIndex].size, 0),
            infoNeedsReview: false,
            createdById: user.id,
          },
        });
        ids.push(group.id);
        await tx.resourceFile.createMany({
          data: groupInput.files.map((entry, orderIndex) => {
            const staged = stagedFiles[entry.fileIndex];
            return {
              workspaceId,
              groupId: group.id,
              originalName: files[entry.fileIndex].name,
              storedName: staged.storedName,
              mimeType: staged.mimeType,
              extension: staged.extension,
              size: staged.size,
              sha256: staged.sha256,
              role: entry.role,
              primaryRoleKey: entry.role === "supplement" ? null : entry.role,
              orderIndex,
              uploadedById: user.id,
            };
          }),
        });
        for (const name of groupInput.tags) {
          const tag = await tx.resourceTag.upsert({
            where: { workspaceId_name: { workspaceId, name } },
            update: {},
            create: { workspaceId, name },
          });
          await tx.resourceGroupTag.create({ data: { groupId: group.id, tagId: tag.id } });
        }
        if (groupInput.courseIds.length > 0) {
          await tx.resourceGroupCoursePermission.createMany({
            data: groupInput.courseIds.map((courseId) => ({ workspaceId, groupId: group.id, courseId })),
          });
        }
      }
      return ids;
    });
    return NextResponse.json({ groupIds: createdIds }, { status: 201 });
  } catch (error) {
    await cleanupStaged(stagedFiles);
    await Promise.all(committedNames.map((name) => removeStoredResourceFile(name).catch(() => undefined)));
    const code = error instanceof Error ? error.message : "upload_failed";
    const status = code.startsWith("duplicate_file:") ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
