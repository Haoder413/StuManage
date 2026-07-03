import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const middleware = readFileSync("middleware.ts", "utf8");
const fallbackPage = readFileSync("src/app/[...path]/page.tsx", "utf8");

assert(
  middleware.includes("isKnownProtectedRoute"),
  "middleware should keep known protected routes redirected while allowing possible custom hidden login paths"
);
assert(
  middleware.includes("return NextResponse.next();"),
  "middleware should allow unknown non-api routes to reach the runtime fallback page"
);
assert(
  fallbackPage.includes("isHiddenLoginPath(pathname)") &&
    fallbackPage.includes("isLoginEnabled()") &&
    fallbackPage.includes("LoginPage"),
  "runtime fallback page should render the login page when the request path matches HIDDEN_LOGIN_PATH"
);
assert(
  fallbackPage.includes('redirect("/")'),
  "runtime fallback page should return unmatched unknown paths to the public home page"
);

console.log("Runtime hidden login fallback checks passed.");
