import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("rejects CDN keys outside Tencent's 6 to 32 alphanumeric limit", () => {
  for (const key of ["short", "a".repeat(33), "abc123_bad"]) {
    assert.throws(
      () =>
        getTencentCdnUrlAuthConfig({
          TENCENT_CDN_URL_AUTH_ENABLED: "true",
          TENCENT_COS_PUBLIC_BASE_URL: "https://video.taotaomath.top",
          TENCENT_CDN_URL_AUTH_KEY: key,
        }),
      /invalid_tencent_cdn_url_auth_key/,
    );
  }
});

test("COS lesson playback returns CDN auth without requiring COS credentials", async () => {
  const previous = {
    enabled: process.env.TENCENT_CDN_URL_AUTH_ENABLED,
    baseUrl: process.env.TENCENT_COS_PUBLIC_BASE_URL,
    key: process.env.TENCENT_CDN_URL_AUTH_KEY,
    bucket: process.env.TENCENT_COS_BUCKET,
    secretId: process.env.TENCENTCLOUD_SECRET_ID,
    secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
  };
  process.env.TENCENT_CDN_URL_AUTH_ENABLED = "true";
  process.env.TENCENT_COS_PUBLIC_BASE_URL = "https://video.taotaomath.top";
  process.env.TENCENT_CDN_URL_AUTH_KEY = "testsecret123";
  delete process.env.TENCENT_COS_BUCKET;
  delete process.env.TENCENTCLOUD_SECRET_ID;
  delete process.env.TENCENTCLOUD_SECRET_KEY;

  try {
    const { getCosLessonVideoPlaybackUrl } = await import("./lesson-video-storage");
    const url = new URL(await getCosLessonVideoPlaybackUrl("lesson-videos/workspace/video.mp4"));
    assert.equal(url.origin, "https://video.taotaomath.top");
    assert.match(url.searchParams.get("sign") || "", /^[0-9a-f]{32}$/);
    assert.match(url.searchParams.get("t") || "", /^\d{10}$/);
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("TENCENT_CDN_URL_AUTH_ENABLED", previous.enabled);
    restore("TENCENT_COS_PUBLIC_BASE_URL", previous.baseUrl);
    restore("TENCENT_CDN_URL_AUTH_KEY", previous.key);
    restore("TENCENT_COS_BUCKET", previous.bucket);
    restore("TENCENTCLOUD_SECRET_ID", previous.secretId);
    restore("TENCENTCLOUD_SECRET_KEY", previous.secretKey);
  }
});

test("deployment guide documents the gated CDN authentication rollout", () => {
  const guide = readFileSync("deploy/README.md", "utf8");
  for (const text of [
    "TENCENT_CDN_URL_AUTH_ENABLED",
    "TENCENT_CDN_URL_AUTH_KEY",
    "Type D",
    "7200",
    "私有存储桶访问",
    "TENCENT_CDN_URL_AUTH_ENABLED=false",
    "openssl rand -hex 16",
    "6 至 32 位",
  ]) {
    assert.ok(guide.includes(text), `deployment guide is missing: ${text}`);
  }
  assert.ok(
    guide.indexOf("先开启私有 COS 回源") < guide.indexOf("再让程序生成 Type D 地址"),
    "private COS origin access must be enabled before the app stops issuing COS signatures",
  );
});
