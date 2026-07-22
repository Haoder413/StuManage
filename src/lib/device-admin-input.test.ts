import assert from "node:assert/strict";
import test from "node:test";
import { parseDeviceLimitOverrideInput, parseDevicePolicyInput } from "./device-admin-input";

const validPolicy = {
  webMobile: 2,
  webDesktop: 3,
  webTablet: 4,
  miniMobile: 5,
  miniDesktop: 6,
  miniTablet: 7,
};

test("global policy requires exactly six integer limits from 1 through 20", () => {
  assert.deepEqual(parseDevicePolicyInput(validPolicy), validPolicy);
  assert.throws(() => parseDevicePolicyInput({ ...validPolicy, webMobile: 0 }), /invalid_device_policy/);
  assert.throws(() => parseDevicePolicyInput({ ...validPolicy, webMobile: 21 }), /invalid_device_policy/);
  assert.throws(() => parseDevicePolicyInput({ ...validPolicy, webMobile: "2" }), /invalid_device_policy/);
  assert.throws(() => parseDevicePolicyInput({ ...validPolicy, extra: 2 }), /invalid_device_policy/);
  assert.throws(() => parseDevicePolicyInput(Object.assign([], validPolicy)), /invalid_device_policy/);
  const missing = { ...validPolicy } as Record<string, unknown>;
  delete missing.miniTablet;
  assert.throws(() => parseDevicePolicyInput(missing), /invalid_device_policy/);
});
test("account override requires exactly six nullable integer limits", () => {
  const override = { ...validPolicy, webMobile: null, miniTablet: null };
  assert.deepEqual(parseDeviceLimitOverrideInput(override), override);
  assert.throws(() => parseDeviceLimitOverrideInput({ ...override, webMobile: "2" }), /invalid_device_override/);
  assert.throws(() => parseDeviceLimitOverrideInput({ ...override, webMobile: 1.5 }), /invalid_device_override/);
  assert.throws(() => parseDeviceLimitOverrideInput({ ...override, webMobile: undefined }), /invalid_device_override/);
  assert.throws(() => parseDeviceLimitOverrideInput({ ...override, extra: null }), /invalid_device_override/);
  assert.throws(() => parseDeviceLimitOverrideInput(new Date()), /invalid_device_override/);
});
