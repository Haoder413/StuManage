import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("group detail route supports edit, add-version and deletion", () => {
  const route = source("src/app/api/resource-groups/[id]/route.ts");
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /normalizeResourceTags/);
  assert.match(route, /totalSize/);
});

test("group file route checks access and isolates HTML previews", () => {
  const route = source("src/app/api/resource-groups/[id]/files/[fileId]/route.ts");
  assert.match(route, /canAccessResourceFile/);
  assert.match(route, /Content-Security-Policy/);
  assert.match(route, /sandbox allow-scripts/);
  assert.doesNotMatch(route, /allow-same-origin/);
});

test("batch course grants validate groups and courses", () => {
  const route = source("src/app/api/resource-groups/batch-courses/route.ts");
  assert.match(route, /getManageableResourceGroupWhere/);
  assert.match(route, /visibleCourseWhere/);
  assert.match(route, /addCourseIds/);
  assert.match(route, /removeCourseIds/);
});

test("primary file versions are protected against concurrent duplicates", () => {
  const route = source("src/app/api/resource-groups/[id]/route.ts");
  assert.match(route, /primaryRoleKey/);
  assert.match(route, /P2002/);
  assert.match(route, /duplicate_primary_role/);
});
