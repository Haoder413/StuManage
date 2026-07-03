import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const page = readFileSync("src/app/teacher-login-2026/page.tsx", "utf8");
const client = readFileSync("src/components/login-page-client.tsx", "utf8");
const fallbackPage = readFileSync("src/app/[...path]/page.tsx", "utf8");

assert(page.includes("isHiddenLoginPath"), "default hidden login route must check current HIDDEN_LOGIN_PATH");
assert(page.includes('redirect("/")'), "default hidden login route must redirect away when it is not the active hidden path");
assert(page.includes("LoginPageClient"), "default hidden login route should render the shared login client");
assert(fallbackPage.includes("LoginPageClient"), "runtime fallback should render the same login client");
assert(client.includes('"use client"'), "login form client component must stay client-side");

console.log("Default hidden login disable checks passed.");
