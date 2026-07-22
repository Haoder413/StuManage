import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { DeviceLimitFields } from "@/components/device-limit-fields";

const draft = {
  webMobile: "1", webDesktop: "2", webTablet: "3",
  miniMobile: "4", miniDesktop: "5", miniTablet: "6",
};

test("all six device limit inputs render disabled during a conflicting operation", () => {
  const html = renderToStaticMarkup(createElement(DeviceLimitFields, {
    draft,
    disabled: true,
    mode: "global",
    onChange() {},
  }));
  assert.equal((html.match(/type="number"/g) ?? []).length, 6);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 6);
});
