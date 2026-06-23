import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { canAccessResource, canManageResources, getVisibleResourceWhere } from "@/lib/resource-access";
import { saveUploadedResourceFile } from "@/lib/resource-storage";

// LearningResource records describe uploaded papers and HTML animations.
function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const type = searchParams.get("type") || "";
  const grade = searchParams.get("grade") || "";
  const subject = searchParams.get("subject") || "";
  const resourceKind = searchParams.get("resourceKind") || type || "";
  const workspaceId = user.role === "admin" ? searchParams.get("workspaceId") || "" : user.workspaceId;
  const visibleWhere = canManageResources(user) ? {} : getVisibleResourceWhere(user);

  const resources = await prisma.learningResource.findMany({
    where: {
      ...visibleWhere,
      ...(workspaceId ? { workspaceId } : {}),
      ...(resourceKind ? { resourceKind } : {}),
      ...(grade ? { grade } : {}),
      ...(subject ? { subject } : {}),
    },
    include: {
      uploadedBy: { select: { name: true } },
      coursePermissions: { select: { courseId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = q
    ? resources.filter((resource) =>
        [resource.title, resource.description, resource.grade, resource.keywords, resource.fileName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : resources;

  const result = await Promise.all(filtered.map(async (resource) => {
    const canPreview = await canAccessResource(user, resource, "preview");
    const canDownload = await canAccessResource(user, resource, "download");
    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      subject: resource.subject,
      resourceKind: resource.resourceKind,
      fileName: resource.fileName,
      mimeType: resource.mimeType,
      extension: resource.extension,
      size: resource.size,
      grade: resource.grade,
      keywords: resource.keywords,
      workspaceId: resource.workspaceId,
      uploadedByName: resource.uploadedBy.name,
      createdAt: resource.createdAt,
      canPreview,
      canDownload,
      courseIds: canManageResources(user) ? resource.coursePermissions.map((permission) => permission.courseId) : undefined,
      coursePermissions: canManageResources(user) ? resource.coursePermissions : undefined,
    };
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  if (!canManageResources(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const saved = await saveUploadedResourceFile(file);
  const resourceKind = String(formData.get("resourceKind") || formData.get("type") || "paper");
  const workspaceId = user.role === "admin"
    ? String(formData.get("workspaceId") || user.workspaceId)
    : user.workspaceId;
  const resource = await prisma.learningResource.create({
    data: {
      workspaceId,
      title: String(formData.get("title") || file.name).trim(),
      description: normalizeText(formData.get("description")),
      type: resourceKind === "animation" ? "animation" : "paper",
      subject: normalizeText(formData.get("subject")) || user.teachingSubject || null,
      resourceKind,
      fileName: file.name,
      storedName: saved.storedName,
      mimeType: saved.mimeType,
      extension: saved.extension,
      size: saved.size,
      grade: normalizeText(formData.get("grade")),
      courseId: normalizeText(formData.get("courseId")),
      keywords: normalizeText(formData.get("keywords")),
      uploadedById: user.id,
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
