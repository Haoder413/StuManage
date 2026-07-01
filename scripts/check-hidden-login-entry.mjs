import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const middleware = readFileSync("middleware.ts", "utf8");
const hiddenLoginPath = readFileSync("src/lib/hidden-login-path.ts", "utf8");
const loginPage = readFileSync("src/app/teacher-login-2026/page.tsx", "utf8");
const serverInit = readFileSync("deploy/server-init.sh", "utf8");

assert(hiddenLoginPath.includes("HIDDEN_LOGIN_PATH"), "hidden login helper must read HIDDEN_LOGIN_PATH");
assert(middleware.includes("NextResponse.rewrite"), "middleware must rewrite configured hidden login path");
assert(serverInit.includes('HIDDEN_LOGIN_PATH="/teacher-login-2026"'), "server env template must include HIDDEN_LOGIN_PATH");
assert(!loginPage.includes('placeholder="teacher / parent / demo"'), "login account placeholder must be empty or removed");
assert(!loginPage.includes("查看网站免责声明"), "login disclaimer link must be removed");

console.log("Hidden login entry checks passed.");
