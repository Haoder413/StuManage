import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const layout = readFileSync("src/app/layout.tsx", "utf8");
const appShell = readFileSync("src/components/app-shell.tsx", "utf8");
const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");

assert(layout.includes("getHiddenLoginPath"), "root layout should read the configured hidden login path on the server");
assert(layout.includes("hiddenLoginPath"), "root layout should pass the hidden login path to the app shell");
assert(appShell.includes("hiddenLoginPath"), "app shell should receive the configured hidden login path");
assert(appShell.includes("isHiddenLoginRoute"), "app shell should centralize login route detection");
assert(sidebar.includes("hiddenLoginPath"), "sidebar should receive the configured hidden login path");
assert(sidebar.includes("isHiddenLoginRoute"), "sidebar should hide itself on the configured hidden login path");

console.log("Custom hidden login fullscreen checks passed.");
