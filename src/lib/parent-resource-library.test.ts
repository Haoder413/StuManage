import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveParentResourcePermissions } from "@/lib/resource-group-access";

test("parent web receives visible course options and grouped resource UI", () => {
  const page = readFileSync("src/app/parent/resources/page.tsx", "utf8");
  assert.match(page, /learningLink/);
  assert.match(page, /isActive: true/);
  assert.match(page, /ParentResourceLibrary/);
});

test("mobile parent resources are paginated groups with nested versions", () => {
  const data = readFileSync("src/lib/mobile-parent-data.ts", "utf8");
  const route = readFileSync("src/app/api/mobile/resources/route.ts", "utf8");
  assert.match(data, /resourceGroup\.findMany/);
  assert.match(data, /files:/);
  assert.match(data, /hasNextPage/);
  assert.match(data, /getVisibleResourceGroupWhere/);
  assert.match(route, /searchParams/);
});

test("parent group response hides unrelated course names", () => {
  const route = readFileSync("src/app/api/resource-groups/route.ts", "utf8");
  assert.match(route, /user\.role !== "parent" \|\| permission\.course\.learningLinks\.length > 0/);
});

test("course access is not weakened by a false direct permission", () => {
  assert.deepEqual(resolveParentResourcePermissions({ canPreview: false, canDownload: false }, true), {
    canPreview: true,
    canDownload: true,
  });
  assert.deepEqual(resolveParentResourcePermissions({ canPreview: true, canDownload: false }, false), {
    canPreview: true,
    canDownload: false,
  });
});

test("mobile HTML resources use a short-lived web-view ticket", () => {
  const ticketRoute = readFileSync("src/app/api/mobile/resources/[groupId]/files/[fileId]/ticket/route.ts", "utf8");
  const viewerRoute = readFileSync("src/app/api/mobile/resources/tickets/[token]/route.ts", "utf8");
  const miniPage = readFileSync("miniprogram/pages/resources/index.js", "utf8");
  assert.match(ticketRoute, /requireMobileParent/);
  assert.match(ticketRoute, /canAccessResourceFile/);
  assert.match(ticketRoute, /expiresAt/);
  assert.match(viewerRoute, /tokenHash/);
  assert.match(viewerRoute, /Content-Security-Policy/);
  assert.match(miniPage, /resource-webview/);
  assert.match(miniPage, /requestGeneration/);
});
