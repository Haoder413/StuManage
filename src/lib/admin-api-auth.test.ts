import assert from "node:assert/strict";
import test from "node:test";
import { requireAdminApi } from "./admin-api-auth";

test("administrator API authentication returns JSON-ready 401 for an anonymous request", async () => {
  const result = await requireAdminApi(async () => null);
  assert.deepEqual(result, {
    ok: false,
    status: 401,
    body: { error: "请先登录" },
  });
});

test("administrator API authentication returns JSON-ready 403 for a signed-in non-admin", async () => {
  const result = await requireAdminApi(async () => ({ id: "teacher-1", name: "教师", role: "teacher" }));
  assert.deepEqual(result, {
    ok: false,
    status: 403,
    body: { error: "无管理员权限" },
  });
});

test("administrator API authentication passes the authenticated administrator through", async () => {
  const admin = { id: "admin-1", name: "管理员", role: "admin" };
  const result = await requireAdminApi(async () => admin);
  assert.deepEqual(result, { ok: true, user: admin });
});
