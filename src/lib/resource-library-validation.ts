import { getResourceExtension, isAllowedResourceExtension } from "@/lib/resource-storage";

export type UploadFileLike = { name: string; size: number };
export type ResourceManifestFile = {
  fileIndex: number;
  role: "student" | "answer" | "supplement";
  confirmDuplicate: boolean;
};
export type ResourceManifestGroup = {
  title: string;
  description: string | null;
  grade: string | null;
  subject: string | null;
  resourceKind: "paper" | "animation" | "material";
  tags: string[];
  courseIds: string[];
  files: ResourceManifestFile[];
};
export type ResourceGroupManifest = { groups: ResourceManifestGroup[] };
export type ResourceGroupSort = "updated" | "created" | "title" | "grade" | "size";
export type ResourceGroupFileState = "" | "student" | "answer" | "complete" | "incomplete";

function configuredLimit(name: string, defaultValue: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, defaultValue) : defaultValue;
}

export function validateUploadBatch(files: UploadFileLike[]) {
  const maxFiles = configuredLimit("RESOURCE_MAX_BATCH_FILES", 50);
  const maxFileBytes = configuredLimit("RESOURCE_MAX_FILE_BYTES", 100 * 1024 * 1024);
  const maxBatchBytes = configuredLimit("RESOURCE_MAX_BATCH_BYTES", 500 * 1024 * 1024);
  if (files.length === 0) throw new Error("missing_files");
  if (files.length > maxFiles) throw new Error("too_many_files");
  let total = 0;
  for (const file of files) {
    if (!file.name.trim() || file.name.length > 255 || file.name.includes("\0")) throw new Error("invalid_file_name");
    if (!isAllowedResourceExtension(getResourceExtension(file.name))) throw new Error("unsupported_resource_type");
    if (file.size <= 0) throw new Error("empty_file");
    if (file.size > maxFileBytes) throw new Error("file_too_large");
    total += file.size;
  }
  if (total > maxBatchBytes) throw new Error("batch_too_large");
  return { maxFiles, maxFileBytes, maxBatchBytes, totalBytes: total };
}

export function normalizeResourceTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 30));
  return Array.from(new Set(tags)).slice(0, 10);
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("invalid_manifest_text");
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error("manifest_text_too_long");
  return text;
}

function stringIds(value: unknown) {
  if (!Array.isArray(value)) throw new Error("invalid_course_ids");
  const ids = value.map((id) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("invalid_course_ids");
    return id.trim();
  });
  return Array.from(new Set(ids));
}

export function parseResourceGroupManifest(raw: string, fileCount: number): ResourceGroupManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("invalid_manifest_json");
  }
  if (!value || typeof value !== "object" || !Array.isArray((value as { groups?: unknown }).groups)) {
    throw new Error("invalid_manifest");
  }
  const rawGroups = (value as { groups: unknown[] }).groups;
  if (rawGroups.length === 0 || rawGroups.length > fileCount) throw new Error("invalid_manifest_groups");
  const usedIndices: number[] = [];
  const roles = new Set(["student", "answer", "supplement"]);
  const kinds = new Set(["paper", "animation", "material"]);

  const groups = rawGroups.map((rawGroup): ResourceManifestGroup => {
    if (!rawGroup || typeof rawGroup !== "object") throw new Error("invalid_manifest_group");
    const group = rawGroup as Record<string, unknown>;
    const title = optionalText(group.title, 200);
    if (!title) throw new Error("missing_group_title");
    if (!kinds.has(String(group.resourceKind))) throw new Error("invalid_resource_kind");
    if (!Array.isArray(group.files) || group.files.length === 0) throw new Error("missing_group_files");
    const primaryRoles = new Set<string>();
    const files = group.files.map((rawFile): ResourceManifestFile => {
      if (!rawFile || typeof rawFile !== "object") throw new Error("invalid_manifest_file");
      const file = rawFile as Record<string, unknown>;
      if (!Number.isInteger(file.fileIndex) || Number(file.fileIndex) < 0 || Number(file.fileIndex) >= fileCount) {
        throw new Error("manifest_file_mismatch");
      }
      const role = String(file.role);
      if (!roles.has(role)) throw new Error("invalid_file_role");
      if (role !== "supplement") {
        if (primaryRoles.has(role)) throw new Error("duplicate_primary_role");
        primaryRoles.add(role);
      }
      usedIndices.push(Number(file.fileIndex));
      return {
        fileIndex: Number(file.fileIndex),
        role: role as ResourceManifestFile["role"],
        confirmDuplicate: file.confirmDuplicate === true,
      };
    });
    return {
      title,
      description: optionalText(group.description, 1000),
      grade: optionalText(group.grade, 30),
      subject: optionalText(group.subject, 30),
      resourceKind: String(group.resourceKind) as ResourceManifestGroup["resourceKind"],
      tags: normalizeResourceTags(group.tags),
      courseIds: stringIds(group.courseIds),
      files,
    };
  });

  const sorted = [...usedIndices].sort((left, right) => left - right);
  if (sorted.length !== fileCount || sorted.some((index, position) => index !== position)) {
    throw new Error("manifest_file_mismatch");
  }
  return { groups };
}

export function parseResourceGroupQuery(searchParams: URLSearchParams) {
  const positiveInteger = (name: string, fallback: number) => {
    const value = Number(searchParams.get(name));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  const allowedSorts = new Set<ResourceGroupSort>(["updated", "created", "title", "grade", "size"]);
  const allowedStates = new Set<ResourceGroupFileState>(["", "student", "answer", "complete", "incomplete"]);
  const sortValue = searchParams.get("sort") || "updated";
  const stateValue = searchParams.get("fileState") || "";
  return {
    q: (searchParams.get("q") || "").trim().slice(0, 100),
    grade: (searchParams.get("grade") || "").trim().slice(0, 30),
    subject: (searchParams.get("subject") || "").trim().slice(0, 30),
    resourceKind: (searchParams.get("resourceKind") || "").trim().slice(0, 20),
    fileState: allowedStates.has(stateValue as ResourceGroupFileState) ? stateValue as ResourceGroupFileState : "",
    courseId: (searchParams.get("courseId") || "").trim().slice(0, 100),
    workspaceId: (searchParams.get("workspaceId") || "").trim().slice(0, 100),
    sort: allowedSorts.has(sortValue as ResourceGroupSort) ? sortValue as ResourceGroupSort : "updated",
    page: positiveInteger("page", 1),
    pageSize: Math.min(positiveInteger("pageSize", 30), 100),
  };
}
