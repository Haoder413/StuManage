import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inferLegacyFileRole } from "./resource-migration";

test("legacy answer names become answer files", () => {
  assert.equal(inferLegacyFileRole("初二期中试卷答案.pdf"), "answer");
  assert.equal(inferLegacyFileRole("函数专题教师版.docx"), "answer");
});

test("uncertain legacy names remain supplements", () => {
  assert.equal(inferLegacyFileRole("初二期中试卷.pdf"), "supplement");
  assert.equal(inferLegacyFileRole("函数专题空白卷.docx"), "student");
});

test("schema stores grouped metadata, file versions, tags and group permissions", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /model ResourceGroup \{/);
  assert.match(schema, /model ResourceFile \{/);
  assert.match(schema, /model ResourceTag \{/);
  assert.match(schema, /model ResourceGroupTag \{/);
  assert.match(schema, /model ResourceGroupCoursePermission \{/);
  assert.match(schema, /model ResourceGroupPermission \{/);
  assert.match(schema, /model LegacyResourceMigration \{/);
  assert.match(schema, /legacyResourceId\s+String\?\s+@unique/);
  assert.match(schema, /totalSize\s+Int\s+@default\(0\)/);
  assert.match(schema, /role\s+String\s+@default\("supplement"\)/);
  assert.match(schema, /sha256\s+String/);
  assert.match(schema, /primaryRoleKey\s+String\?/);
  assert.match(schema, /@@unique\(\[groupId, primaryRoleKey\]\)/);
});

test("legacy migration is idempotent and copies both permission types", () => {
  const migration = readFileSync("src/lib/resource-migration.ts", "utf8");

  assert.match(migration, /export async function migrateLegacyResources/);
  assert.match(migration, /legacyResourceId/);
  assert.match(migration, /resourceGroupCoursePermission/);
  assert.match(migration, /resourceGroupPermission/);
  assert.match(migration, /createHash\("sha256"\)/);
  assert.match(migration, /primaryRoleKey/);
  assert.match(migration, /legacyResourceMigration/);
  assert.match(migration, /cloneStoredResourceFile/);
});
