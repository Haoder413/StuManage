import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const accountMenuPath = "src/components/account-menu.tsx";
assert.ok(existsSync(accountMenuPath), "a shared account menu component should exist");

const accountMenu = readFileSync(accountMenuPath, "utf8");
const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");
const parentSidebar = readFileSync("src/components/parent-sidebar.tsx", "utf8");

for (const snippet of [
  '@radix-ui/react-dropdown-menu',
  'fetch("/api/account/me")',
  'fetch("/api/auth/logout"',
  "个人设置",
  "退出登录",
  "UserRound",
  "focus-visible:ring-2",
  "DropdownMenu.Label",
  "退出失败，请重试",
]) {
  assert.match(accountMenu, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `account menu should contain ${snippet}`);
}

assert.match(sidebar, /AccountMenu/, "teacher sidebar should use the shared account menu");
assert.match(sidebar, /settingsHref="\/settings"/, "teacher account menu should open teacher settings");
assert.doesNotMatch(sidebar, /async function logout/, "teacher sidebar should not own logout behavior");

assert.match(parentSidebar, /AccountMenu/, "parent sidebar should use the shared account menu");
assert.match(parentSidebar, /settingsHref="\/parent\/settings"/, "parent account menu should open parent settings");
assert.match(parentSidebar, /variant="mobile"/, "parent mobile navigation should expose the account menu");
assert.doesNotMatch(parentSidebar, /LogoutButton/, "parent sidebar should not keep a separate logout button");

console.log("Shared account menu is present in teacher, parent, and mobile navigation.");
