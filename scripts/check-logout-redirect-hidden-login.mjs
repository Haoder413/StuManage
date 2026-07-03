import assert from "node:assert/strict";
import { getLogoutRedirectPath } from "../src/lib/hidden-login-path.ts";

function withHiddenLoginPath(value, callback) {
  const previous = process.env.HIDDEN_LOGIN_PATH;
  if (value === undefined) delete process.env.HIDDEN_LOGIN_PATH;
  else process.env.HIDDEN_LOGIN_PATH = value;

  try {
    callback();
  } finally {
    if (previous === undefined) delete process.env.HIDDEN_LOGIN_PATH;
    else process.env.HIDDEN_LOGIN_PATH = previous;
  }
}

withHiddenLoginPath(undefined, () => {
  assert.equal(getLogoutRedirectPath(), "/teacher-login-2026");
});

withHiddenLoginPath("private-login/", () => {
  assert.equal(getLogoutRedirectPath(), "/private-login");
});

console.log("Logout redirect hidden login checks passed.");
