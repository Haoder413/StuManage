import assert from "node:assert/strict";
import test from "node:test";
import { getManageableResourceGroupWhere, getVisibleResourceGroupWhere } from "./resource-group-access";

test("admin can query all resource groups", () => {
  assert.deepEqual(getVisibleResourceGroupWhere({ id: "a", role: "admin", workspaceId: "w" }), {});
});

test("teacher sees own groups or groups assigned to visible courses", () => {
  const where = getVisibleResourceGroupWhere({ id: "teacher-1", role: "teacher", workspaceId: "w" });
  assert.deepEqual(where, {
    workspaceId: "w",
    OR: [
      { createdById: "teacher-1" },
      { coursePermissions: { some: { course: {
        workspaceId: "w",
        OR: [
          { createdById: "teacher-1" },
          { learningLinks: { some: { workspaceId: "w", teacherId: "teacher-1", isActive: true } } },
        ],
      } } } },
    ],
  });
});

test("parent sees direct grants or groups from active course links", () => {
  const where = getVisibleResourceGroupWhere({ id: "parent-1", role: "parent", workspaceId: "w" });
  assert.deepEqual(where, {
    workspaceId: "w",
    OR: [
      { permissions: { some: {
        userId: "parent-1",
        workspaceId: "w",
        OR: [{ canPreview: true }, { canDownload: true }],
      } } },
      { coursePermissions: { some: { course: { learningLinks: { some: {
        workspaceId: "w",
        parentId: "parent-1",
        isActive: true,
      } } } } } },
    ],
  });
});

test("teacher can manage only groups they created", () => {
  assert.deepEqual(getManageableResourceGroupWhere({ id: "teacher-1", role: "teacher", workspaceId: "w" }), {
    workspaceId: "w",
    createdById: "teacher-1",
  });
  assert.deepEqual(getManageableResourceGroupWhere({ id: "admin", role: "admin", workspaceId: "w" }), {});
  assert.deepEqual(getManageableResourceGroupWhere({ id: "demo", role: "demo", workspaceId: "w" }), { workspaceId: "w" });
});
