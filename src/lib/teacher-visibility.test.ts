import assert from "node:assert/strict";
import test from "node:test";

import { canDeleteStudent, deletableStudentByIdWhere } from "./teacher-visibility";

const baseUser = {
  id: "user-1",
  workspaceId: "workspace-1",
};

test("only administrators can delete students", () => {
  const student = { createdById: "user-1" };

  assert.equal(canDeleteStudent({ ...baseUser, role: "admin" }, student), true);
  assert.equal(canDeleteStudent({ ...baseUser, role: "teacher" }, student), false);
  assert.equal(canDeleteStudent({ ...baseUser, role: "demo" }, student), false);
});

test("non-administrators receive a delete filter that cannot match a student", () => {
  assert.deepEqual(
    deletableStudentByIdWhere({ ...baseUser, role: "teacher" }, "student-1"),
    { id: "__admin_only__", workspaceId: "workspace-1" },
  );
});
