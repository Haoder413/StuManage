import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DEVICE_LIMITS,
  cleanLimitedText,
  detectDeviceType,
  deviceLimitKey,
  effectiveDeviceLimits,
  validateDeviceLimitOverrides,
  validateDeviceLimits,
} from "./device-session-policy";

test("maps every channel and device type to its limit key", () => {
  assert.equal(deviceLimitKey("web", "mobile"), "webMobile");
  assert.equal(deviceLimitKey("web", "desktop"), "webDesktop");
  assert.equal(deviceLimitKey("web", "tablet"), "webTablet");
  assert.equal(deviceLimitKey("miniProgram", "mobile"), "miniMobile");
  assert.equal(deviceLimitKey("miniProgram", "desktop"), "miniDesktop");
  assert.equal(deviceLimitKey("miniProgram", "tablet"), "miniTablet");
});

test("detects desktop, mobile, Android tablet and iPad user agents", () => {
  assert.equal(detectDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126"), "desktop");
  assert.equal(detectDeviceType("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile"), "mobile");
  assert.equal(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile"), "mobile");
  assert.equal(detectDeviceType("Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit Safari"), "tablet");
  assert.equal(detectDeviceType("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Mobile"), "tablet");
  assert.equal(detectDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Mobile/15E148"), "tablet");
});

test("uses two as the default for all six device limits", () => {
  assert.deepEqual(DEFAULT_DEVICE_LIMITS, {
    webMobile: 2,
    webDesktop: 2,
    webTablet: 2,
    miniMobile: 2,
    miniDesktop: 2,
    miniTablet: 2,
  });
});

test("accepts complete global limits at inclusive boundaries", () => {
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMobile: 1, miniTablet: 20 }), true);
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMobile: 0 }), false);
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMobile: 21 }), false);
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMobile: 1.5 }), false);
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMobile: "2" }), false);
  assert.equal(validateDeviceLimits({ webMobile: 2 }), false);
  assert.equal(validateDeviceLimits({ ...DEFAULT_DEVICE_LIMITS, webMoblie: 2 }), false);
});

test("accepts nullable or omitted overrides and rejects invalid values", () => {
  assert.equal(validateDeviceLimitOverrides({}), true);
  assert.equal(validateDeviceLimitOverrides({ webMobile: null, miniTablet: 20 }), true);
  assert.equal(validateDeviceLimitOverrides({ webMobile: 1 }), true);
  assert.equal(validateDeviceLimitOverrides({ webMobile: 0 }), false);
  assert.equal(validateDeviceLimitOverrides({ webMobile: 21 }), false);
  assert.equal(validateDeviceLimitOverrides({ webMobile: 1.5 }), false);
  assert.equal(validateDeviceLimitOverrides({ webMobile: "2" }), false);
  assert.equal(validateDeviceLimitOverrides({ webMoblie: 2 }), false);
});

test("cleans and limits optional device metadata text", () => {
  assert.equal(cleanLimitedText("  Safari\n\t17  ", 20), "Safari 17");
  assert.equal(cleanLimitedText("abcdef", 4), "abcd");
  assert.equal(cleanLimitedText(" \n\t "), null);
  assert.equal(cleanLimitedText(17), null);
});

test("merges only non-null user overrides into global limits", () => {
  const global = { ...DEFAULT_DEVICE_LIMITS, webMobile: 3, miniDesktop: 4 };
  assert.deepEqual(effectiveDeviceLimits(global, { webMobile: null, miniDesktop: 7, miniTablet: undefined }), {
    ...global,
    miniDesktop: 7,
  });
});
