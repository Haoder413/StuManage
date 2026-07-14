import { normalizeResourceTags, parseOptionalResourceYear } from "@/lib/resource-library-validation";
import { normalizeResourceGrade } from "@/lib/resource-metadata";

function requiredText(value: unknown, code: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${code}_too_long`);
  return text;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("invalid_text");
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error("text_too_long");
  return text;
}

function ids(value: unknown, required = false) {
  if (!Array.isArray(value)) throw new Error("invalid_ids");
  const result = Array.from(new Set(value.map((item) => requiredText(item, "invalid_id", 100))));
  if (required && result.length === 0) throw new Error("missing_ids");
  return result;
}

export function parseResourceGroupUpdate(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("invalid_group_update");
  const input = value as Record<string, unknown>;
  const resourceKind = String(input.resourceKind || "");
  if (!new Set(["paper", "animation", "material"]).has(resourceKind)) throw new Error("invalid_resource_kind");
  return {
    title: requiredText(input.title, "missing_title", 200),
    description: optionalText(input.description, 1000),
    grade: normalizeResourceGrade(optionalText(input.grade, 30)),
    year: parseOptionalResourceYear(input.year),
    subject: optionalText(input.subject, 30),
    resourceKind: resourceKind as "paper" | "animation" | "material",
    tags: normalizeResourceTags(input.tags),
    confirmInformation: input.confirmInformation === true,
  };
}

export function parseBatchCourseChange(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("invalid_course_change");
  const input = value as Record<string, unknown>;
  const groupIds = ids(input.groupIds, true);
  const addCourseIds = ids(input.addCourseIds);
  const removeCourseIds = ids(input.removeCourseIds);
  if (addCourseIds.some((id) => removeCourseIds.includes(id))) throw new Error("course_change_overlap");
  if (addCourseIds.length === 0 && removeCourseIds.length === 0) throw new Error("empty_course_change");
  return { groupIds, addCourseIds, removeCourseIds };
}
