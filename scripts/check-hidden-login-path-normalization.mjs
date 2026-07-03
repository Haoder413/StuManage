import assert from "node:assert/strict";
import {
  getHiddenLoginPath,
  isDefaultHiddenLoginPath,
  isHiddenLoginPath,
} from "../src/lib/hidden-login-path.ts";

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
  assert.equal(getHiddenLoginPath(), "/teacher-login-2026");
  assert.equal(isHiddenLoginPath("/teacher-login-2026"), true);
  assert.equal(isHiddenLoginPath("/teacher-login-2026/"), true);
  assert.equal(isDefaultHiddenLoginPath("/teacher-login-2026/"), true);
});

withHiddenLoginPath("private-login/", () => {
  assert.equal(getHiddenLoginPath(), "/private-login");
  assert.equal(isHiddenLoginPath("/private-login"), true);
  assert.equal(isHiddenLoginPath("/private-login/"), true);
});

console.log("Hidden login path normalization checks passed.");
