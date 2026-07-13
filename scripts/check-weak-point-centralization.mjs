import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const domain = read("src/lib/weak-points.ts");
const hook = read("src/hooks/use-weak-point-tags.ts");
const route = read("src/app/api/weak-points/route.ts");
const reuse = read("src/lib/weak-point-reuse.ts");
const parentData = read("src/lib/parent-data.ts");
const dashboard = read("src/app/dashboard/page.tsx");
const parentProgress = read("src/app/parent/progress/page.tsx");
const teacherProgress = read("src/app/progress/students/[id]/page.tsx");
const mobileParentData = read("src/lib/mobile-parent-data.ts");

for (const snippet of [
  "normalizeWeakPointDescription",
  "normalizeWeakPointDescriptions",
  "dedupeWeakPoints",
  "getWeakPointStatusCounts",
  "filterWeakPointsByStatus",
]) {
  assert.match(domain, new RegExp(`export function ${snippet}`), `${snippet} should be a shared weak-point domain rule`);
}

assert.match(hook, /export function useWeakPointTags/, "exam pages should share weak-point tag loading and creation");
assert.match(hook, /weakPointTagsLoading/, "shared tag hook should expose its loading state");

for (const file of [
  "src/app/exams/page.tsx",
  "src/app/exams/new/page.tsx",
  "src/app/exams/students/[id]/page.tsx",
]) {
  const source = read(file);
  assert.match(source, /useWeakPointTags/, `${file} should use the shared weak-point tag hook`);
  assert.doesNotMatch(source, /function createWeakPointTag/, `${file} should not duplicate tag creation`);
}

assert.match(route, /from "@\/lib\/weak-points"/, "weak-point API should use shared domain rules");
assert.match(reuse, /from "@\/lib\/weak-points"/, "exam reuse should use shared domain rules");
assert.match(reuse, /export async function ensureWeakPointReview/, "weak-point creation and reactivation should be shared");
assert.match(route, /ensureWeakPointReview/, "manual weak-point creation should use the shared lifecycle service");
assert.doesNotMatch(route, /prisma\.weakPoint\.create\(/, "manual route should not duplicate weak-point creation");
assert.match(route, /data\.learningLinkId && !learningLink/, "explicit invalid learning links should be rejected");
assert.match(route, /learningLink\.studentId !== student\.id/, "learning links should belong to the requested student");
assert.match(parentData, /from "@\/lib\/weak-points"/, "parent data should use shared domain rules");
assert.match(dashboard, /from "@\/lib\/weak-points"/, "dashboard should use shared normalization");
assert.match(parentProgress, /getWeakPointStatusCounts/, "parent progress should use shared counts");
assert.match(parentProgress, /filterWeakPointsByStatus/, "parent progress should use shared filtering");
assert.match(teacherProgress, /getWeakPointStatusCounts/, "teacher progress should use shared counts");
assert.match(teacherProgress, /filterWeakPointsByStatus/, "teacher progress should use shared filtering");
assert.match(mobileParentData, /getWeakPointStatusCounts/, "mobile parent data should use shared counts");

console.log("Weak-point domain and tag operations are centralized.");
