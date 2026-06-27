import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const middleware = readFileSync("middleware.ts", "utf8");
const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");
const loginRoute = readFileSync("src/app/api/auth/login/route.ts", "utf8");
const accountMeRoute = readFileSync("src/app/api/account/me/route.ts", "utf8");
const accountsPage = readFileSync("src/app/accounts/page.tsx", "utf8");

assert.doesNotMatch(
  middleware,
  /student_management_role|ROLE_COOKIE/,
  "middleware should not route by a separate role cookie because it can go stale against the session"
);

assert.doesNotMatch(
  sidebar,
  /document\.cookie|student_management_role/,
  "sidebar should read admin visibility from the server session or /api/account/me, not a role cookie"
);

assert.doesNotMatch(
  loginRoute,
  /ROLE_COOKIE|student_management_role/,
  "login should not create a separate role cookie for authorization decisions"
);

assert.match(accountMeRoute, /getCurrentUser/, "account/me should read the current user from the session");
assert.match(accountMeRoute, /role: user\.role/, "account/me should return the session user's role");
assert.match(accountsPage, /requireAdmin/, "accounts page should still be protected by session-backed admin auth");

console.log("Admin account visibility uses the session as the single role source.");
