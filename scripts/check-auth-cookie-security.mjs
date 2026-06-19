import { readFileSync } from "node:fs";

const auth = readFileSync("src/lib/auth.ts", "utf8");
const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");

const checks = [
  {
    ok: auth.includes("cookieSecure?: boolean"),
    message: "createSession should accept a request-aware cookieSecure option.",
  },
  {
    ok: auth.includes("secure: Boolean(cookieSecure)"),
    message: "Session cookie should use the request-aware cookieSecure value.",
  },
  {
    ok: login.includes("getCookieSecure(request)"),
    message: "Login route should derive cookie security from the incoming request.",
  },
  {
    ok: login.includes("x-forwarded-proto"),
    message: "Login route should respect the proxy protocol header from Nginx.",
  },
];

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(failed.map((check) => `- ${check.message}`).join("\n"));
  process.exit(1);
}

console.log("Auth cookie security checks passed.");
