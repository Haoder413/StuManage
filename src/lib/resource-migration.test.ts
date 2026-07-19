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
  assert.match(schema, /year\s+Int\?/);
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
  assert.match(migration, /year: null/);
  assert.match(migration, /extractResourceYear/);
  assert.match(migration, /backfilledYears/);
});

test("schema stores login devices, policies, consent and audit history", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /model LoginDevice \{/);
  assert.match(schema, /@@unique\(\[userId, channel, deviceKeyHash\]\)/);
  assert.match(schema, /@@index\(\[userId, channel, deviceType\]\)/);
  assert.match(schema, /@@index\(\[userId, lastSeenAt\]\)/);
  assert.match(schema, /model DeviceLoginPolicy \{/);
  assert.match(schema, /webMobile\s+Int\s+@default\(2\)/);
  assert.match(schema, /miniTablet\s+Int\s+@default\(2\)/);
  assert.match(schema, /model UserDeviceLimitOverride \{/);
  assert.match(schema, /userId\s+String\s+@unique/);
  assert.match(schema, /model PrivacyConsent \{/);
  assert.match(schema, /@@unique\(\[userId, channel, version\]\)/);
  assert.match(schema, /model AdminAuditLog \{/);
  assert.match(schema, /@relation\("AdminAuditLogs"/);
  assert.match(schema, /@relation\("TargetAuditLogs"/);
  assert.match(schema, /actorUserIdSnapshot\s+String/);
  assert.match(schema, /actorNameSnapshot\s+String/);
  assert.match(schema, /targetUserIdSnapshot\s+String\?/);
  assert.match(schema, /targetNameSnapshot\s+String\?/);
  assert.match(schema, /@@index\(\[targetUserId, createdAt\]\)/);
  assert.match(schema, /@@index\(\[adminId, createdAt\]\)/);
  assert.match(schema, /model SystemMigration \{/);
  assert.match(schema, /key\s+String\s+@id/);
});

test("sessions optionally track their device, channel and last activity", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /deviceId\s+String\?/);
  assert.match(schema, /channel\s+String\?/);
  assert.match(schema, /lastSeenAt\s+DateTime\?/);
  assert.match(schema, /device\s+LoginDevice\?\s+@relation\(fields: \[deviceId\], references: \[id\], onDelete: SetNull\)/);
  assert.match(schema, /@@index\(\[deviceId\]\)/);
  assert.match(schema, /@@index\(\[userId\]\)/);
  assert.match(schema, /@@index\(\[expiresAt\]\)/);
});
