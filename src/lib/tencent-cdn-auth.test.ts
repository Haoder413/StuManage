import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTencentCdnTypeDUrl,
  getTencentCdnUrlAuthConfig,
} from "./tencent-cdn-auth";

test("builds a deterministic Tencent CDN Type D URL", () => {
  const url = buildTencentCdnTypeDUrl("lesson-videos/workspace/2026/07/video.mp4", {
    baseUrl: "https://video.taotaomath.top/",
    key: "test-secret",
    issuedAtSeconds: 1784764800,
  });

  assert.equal(
    url,
    "https://video.taotaomath.top/lesson-videos/workspace/2026/07/video.mp4?sign=e062d686ae83721b53ac20b4d24a5277&t=1784764800",
  );
});

test("encodes object-key path segments before signing the request path", () => {
  const url = new URL(
    buildTencentCdnTypeDUrl("lesson-videos/a folder/video (1).mp4", {
      baseUrl: "https://video.taotaomath.top",
      key: "test-secret",
      issuedAtSeconds: 1784764800,
    }),
  );

  assert.equal(url.pathname, "/lesson-videos/a%20folder/video%20(1).mp4");
  assert.match(url.searchParams.get("sign") || "", /^[0-9a-f]{32}$/);
  assert.equal(url.searchParams.get("t"), "1784764800");
});

test("keeps CDN authentication disabled unless explicitly enabled", () => {
  assert.equal(getTencentCdnUrlAuthConfig({}), null);
  assert.equal(
    getTencentCdnUrlAuthConfig({
      TENCENT_CDN_URL_AUTH_ENABLED: "false",
      TENCENT_COS_PUBLIC_BASE_URL: "https://video.taotaomath.top",
      TENCENT_CDN_URL_AUTH_KEY: "secret",
    }),
    null,
  );
});

test("fails closed when enabled CDN authentication is incomplete", () => {
  assert.throws(
    () =>
      getTencentCdnUrlAuthConfig({
        TENCENT_CDN_URL_AUTH_ENABLED: "true",
        TENCENT_COS_PUBLIC_BASE_URL: "https://video.taotaomath.top",
      }),
    /missing_tencent_cdn_url_auth_key/,
  );
});
