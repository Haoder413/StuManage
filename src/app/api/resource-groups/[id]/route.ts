import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireTeacherLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManageableResourceGroupWhere } from "@/lib/resource-group-access";
import { parseResourceGroupUpdate } from "@/lib/resource-group-input";
import { normalizeResourceTags, validateUploadBatch } from "@/lib/resource-library-validation";
import {
  commitStagedResourceFile,
  removeStagedResourceFile,
  removeStoredResourceFile,
  stageUploadedResourceFile,
} from "@/lib/resource-storage";

async function manageableGroup(user: Awaited<ReturnType<typeof requireTeacherLike>>, id: string) {
  return prisma.resourceGroup.findFirst({
    where: { id, ...getManageableResourceGroupWhere(user) },
    include: { files: true },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const group = await manageableGroup(user, params.id);
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const input = parseResourceGroupUpdate(await request.json());
    const updated = await prisma.$transaction(async (tx) => {
      await tx.resourceGroupTag.deleteMany({ where: { groupId: group.id } });
      for (const name of normalizeResourceTags(input.tags)) {
        const tag = await tx.resourceTag.upsert({
          where: { workspaceId_name: { workspaceId: group.workspaceId, name } },
          update: {},
          create: { workspaceId: group.workspaceId, name },
        });
        await tx.resourceGroupTag.create({ data: { groupId: group.id, tagId: tag.id } });
      }
      return tx.resourceGroup.update({
        where: { id: group.id },
        data: {
          title: input.title,
          description: input.description,
          grade: input.grade,
          subject: input.subject,
          resourceKind: input.resourceKind,
          ...(input.confirmInformation ? { infoNeedsReview: false } : {}),
        },
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_update";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const group = await manageableGroup(user, params.id);
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let staged: Awaited<ReturnType<typeof stageUploadedResourceFile>> | null = null;
  let committed = false;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("missing_file");
    validateUploadBatch([file]);
    const role = String(formData.get("role") || "supplement");
    if (!new Set(["student", "answer", "supplement"]).has(role)) throw new Error("invalid_file_role");
    if (role !== "supplement" && group.files.some((item) => item.role === role)) throw new Error("duplicate_primary_role");

    staged = await stageUploadedResourceFile(file);
    const duplicate = await prisma.resourceFile.findFirst({
      where: { workspaceId: group.workspaceId, sha256: staged.sha256 },
      select: { id: true },
    });
    if (duplicate && formData.get("confirmDuplicate") !== "true") throw new Error("duplicate_file");
    await commitStagedResourceFile(staged);
    committed = true;
    const created = await prisma.$transaction(async (tx) => {
      const resourceFile = await tx.resourceFile.create({
        data: {
          workspaceId: group.workspaceId,
          groupId: group.id,
          originalName: file.name,
          storedName: staged!.storedName,
          mimeType: staged!.mimeType,
          extension: staged!.extension,
          size: staged!.size,
          sha256: staged!.sha256,
          role,
          primaryRoleKey: role === "supplement" ? null : role,
          orderIndex: group.files.length,
          uploadedById: user.id,
        },
      });
      await tx.resourceGroup.update({
        where: { id: group.id },
        data: { totalSize: { increment: staged!.size }, updatedAt: new Date() },
      });
      return resourceFile;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (staged && !committed) await removeStagedResourceFile(staged).catch(() => undefined);
    if (staged && committed) await removeStoredResourceFile(staged.storedName).catch(() => undefined);
    const code = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      ? "duplicate_primary_role"
      : error instanceof Error ? error.message : "upload_failed";
    return NextResponse.json({ error: code }, { status: code === "duplicate_file" ? 409 : 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireTeacherLike();
  const group = await manageableGroup(user, params.id);
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (fileId) {
    const file = group.files.find((item) => item.id === fileId);
    if (!file) return NextResponse.json({ error: "file_not_found" }, { status: 404 });
    await prisma.$transaction([
      prisma.resourceFile.delete({ where: { id: file.id } }),
      prisma.resourceGroup.update({
        where: { id: group.id },
        data: { totalSize: { decrement: file.size }, updatedAt: new Date() },
      }),
    ]);
    await removeStoredResourceFile(file.storedName).catch(() => undefined);
    return NextResponse.json({ deletedFileId: file.id });
  }

  await prisma.resourceGroup.delete({ where: { id: group.id } });
  await Promise.all(group.files.map((file) => removeStoredResourceFile(file.storedName).catch(() => undefined)));
  return NextResponse.json({ deletedGroupId: group.id });
}
