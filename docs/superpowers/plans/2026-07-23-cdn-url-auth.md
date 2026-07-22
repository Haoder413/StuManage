# Secure CDN Video Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate short-lived Tencent CDN Type D URLs only after the existing lesson-video permission check, while preserving a disabled-by-default fallback for a no-downtime rollout.

**Architecture:** Put Tencent CDN signing and environment validation in a small pure server-side module. The existing COS playback adapter selects CDN signing only when an explicit switch is enabled; otherwise it keeps the current COS-signed compatibility path. Tencent CDN enforces the two-hour lifetime and privately reads COS after the console cutover.

**Tech Stack:** TypeScript, Node.js `crypto`, Node test runner through `tsx`, Next.js 14, Tencent CDN Type D authentication, Tencent COS SDK.

---

## File structure

- Create `src/lib/tencent-cdn-auth.ts`: validate server-only CDN settings and build deterministic Type D URLs.
- Create `src/lib/tencent-cdn-auth.test.ts`: unit-test signing, encoding, disabled mode, and fail-closed configuration.
- Modify `src/lib/lesson-video-storage.ts`: select CDN Type D URLs before creating a COS client; retain the old path while disabled.
- Modify `scripts/check-lesson-video-cos.mjs`: assert that COS playback uses the new helper and does not regress to unconditional hostname replacement.
- Modify `deploy/README.md`: document shared-environment variables, safe console order, verification, and rollback.

### Task 1: Add the Tencent CDN Type D signer

**Files:**
- Create: `src/lib/tencent-cdn-auth.ts`
- Test: `src/lib/tencent-cdn-auth.test.ts`

- [ ] **Step 1: Write the failing signer tests**

Create `src/lib/tencent-cdn-auth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
```

Expected: FAIL because `src/lib/tencent-cdn-auth.ts` does not exist.

- [ ] **Step 3: Implement the minimal signer and configuration guard**

Create `src/lib/tencent-cdn-auth.ts`:

```ts
import { createHash } from "node:crypto";

type CdnAuthEnvironment = Record<string, string | undefined>;

export type TencentCdnUrlAuthConfig = {
  baseUrl: string;
  key: string;
};

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error("invalid_tencent_cos_public_base_url");
  }
  return url.toString().replace(/\/$/, "");
}

function encodeObjectPath(objectKey: string) {
  const normalized = objectKey.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("invalid_cos_object_key");
  }
  return `/${normalized.split("/").map(encodeURIComponent).join("/")}`;
}

export function getTencentCdnUrlAuthConfig(
  environment: CdnAuthEnvironment = process.env,
): TencentCdnUrlAuthConfig | null {
  if (environment.TENCENT_CDN_URL_AUTH_ENABLED !== "true") return null;

  const baseUrl = environment.TENCENT_COS_PUBLIC_BASE_URL;
  const key = environment.TENCENT_CDN_URL_AUTH_KEY;
  if (!baseUrl) throw new Error("missing_tencent_cos_public_base_url");
  if (!key) throw new Error("missing_tencent_cdn_url_auth_key");

  return { baseUrl: normalizeBaseUrl(baseUrl), key };
}

export function buildTencentCdnTypeDUrl(
  objectKey: string,
  options: TencentCdnUrlAuthConfig & { issuedAtSeconds?: number },
) {
  const pathname = encodeObjectPath(objectKey);
  const timestamp = String(options.issuedAtSeconds ?? Math.floor(Date.now() / 1000));
  const sign = createHash("md5")
    .update(`${options.key}${pathname}${timestamp}`)
    .digest("hex");
  const url = new URL(pathname, `${normalizeBaseUrl(options.baseUrl)}/`);
  url.searchParams.set("sign", sign);
  url.searchParams.set("t", timestamp);
  return url.toString();
}
```

- [ ] **Step 4: Run the signer tests and verify GREEN**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the signer**

```bash
git add src/lib/tencent-cdn-auth.ts src/lib/tencent-cdn-auth.test.ts
git commit -m "feat: add Tencent CDN Type D signer"
```

### Task 2: Integrate signing into COS video playback

**Files:**
- Modify: `src/lib/lesson-video-storage.ts:1-10,337-374`
- Modify: `scripts/check-lesson-video-cos.mjs:24-40`
- Test: `src/lib/tencent-cdn-auth.test.ts`

- [ ] **Step 1: Add a failing integration test**

Append to `src/lib/tencent-cdn-auth.test.ts`:

```ts
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
  process.env.TENCENT_CDN_URL_AUTH_KEY = "test-secret";
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
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
```

Expected: FAIL with `missing_tencent_cos_bucket`, proving the old path still initializes COS.

- [ ] **Step 3: Select CDN authentication before COS signing**

Add this import to `src/lib/lesson-video-storage.ts`:

```ts
import {
  buildTencentCdnTypeDUrl,
  getTencentCdnUrlAuthConfig,
} from "@/lib/tencent-cdn-auth";
```

At the start of `getCosLessonVideoPlaybackUrl`, immediately after validating `cosObjectKey`, add:

```ts
  const cdnAuth = getTencentCdnUrlAuthConfig();
  if (cdnAuth) {
    return buildTencentCdnTypeDUrl(cosObjectKey, cdnAuth);
  }
```

Keep the existing COS-signed branch unchanged below it so `TENCENT_CDN_URL_AUTH_ENABLED` absent or `false` remains a safe rollout fallback.

Update `scripts/check-lesson-video-cos.mjs` with:

```js
assertIncludes(storage, "getTencentCdnUrlAuthConfig", "COS playback should read CDN auth config");
assertIncludes(storage, "buildTencentCdnTypeDUrl", "COS playback should generate CDN Type D URLs");
```

Read the helper source in the script before asserting the environment name:

```js
const cdnAuth = read("src/lib/tencent-cdn-auth.ts");
```

Then change the final environment assertion to:

```js
assertIncludes(cdnAuth, "TENCENT_CDN_URL_AUTH_ENABLED", "CDN auth should use an explicit rollout switch");
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
node scripts/check-lesson-video-cos.mjs
```

Expected: 5 tests pass and the COS support checker prints `Lesson video COS storage support is present.`

- [ ] **Step 5: Commit the integration**

```bash
git add src/lib/lesson-video-storage.ts src/lib/tencent-cdn-auth.test.ts scripts/check-lesson-video-cos.mjs
git commit -m "feat: issue authenticated CDN video URLs"
```

### Task 3: Document the safe server and console rollout

**Files:**
- Modify: `deploy/README.md`
- Test: `src/lib/tencent-cdn-auth.test.ts`

- [ ] **Step 1: Add a failing documentation contract test**

Add `readFileSync` to the imports at the top of `src/lib/tencent-cdn-auth.test.ts`, then append the test:

```ts
import { readFileSync } from "node:fs";

test("deployment guide documents the gated CDN authentication rollout", () => {
  const guide = readFileSync("deploy/README.md", "utf8");
  for (const text of [
    "TENCENT_CDN_URL_AUTH_ENABLED",
    "TENCENT_CDN_URL_AUTH_KEY",
    "Type D",
    "7200",
    "私有存储桶访问",
    "TENCENT_CDN_URL_AUTH_ENABLED=false",
  ]) {
    assert.ok(guide.includes(text), `deployment guide is missing: ${text}`);
  }
});
```

- [ ] **Step 2: Run the documentation test and verify RED**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
```

Expected: FAIL because the deployment guide does not yet contain the new variables and safe sequence.

- [ ] **Step 3: Add the exact deployment procedure**

Append a `课程视频 CDN 鉴权切换` section to `deploy/README.md` containing:

```bash
# 第一次部署：先保持关闭，不影响现有播放
read -rsp '请输入与腾讯云 CDN Type D 完全相同的鉴权密钥：' TENCENT_CDN_KEY
echo
sudo sed -i '/^TENCENT_CDN_URL_AUTH_ENABLED=/d' /opt/student-management/shared/.env
sudo sed -i '/^TENCENT_CDN_URL_AUTH_KEY=/d' /opt/student-management/shared/.env
printf 'TENCENT_CDN_URL_AUTH_ENABLED=false\nTENCENT_CDN_URL_AUTH_KEY=%s\n' "$TENCENT_CDN_KEY" \
  | sudo tee -a /opt/student-management/shared/.env >/dev/null
unset TENCENT_CDN_KEY
```

Document this console configuration without exposing the key in screenshots or shell history:

1. CDN domain `video.taotaomath.top` → 访问控制 → 鉴权配置 → Type D.
2. Use decimal Unix timestamp, signature parameters `sign` and `t`, validity `7200` seconds, and video-file suffix scope.
3. CDN domain → 基本配置 → 源站配置 → enable 私有存储桶访问.
4. COS bucket → 权限管理 → set 私有读写 after private-origin verification.
5. Set `TENCENT_CDN_URL_AUTH_ENABLED=true`, rebuild, and restart PM2.

Document rollback: set `TENCENT_CDN_URL_AUTH_ENABLED=false`, restart, then temporarily disable CDN URL authentication only if old COS-signed fallback must be restored.

- [ ] **Step 4: Run documentation and focused tests**

Run:

```bash
node --import tsx --test src/lib/tencent-cdn-auth.test.ts
node scripts/check-lesson-video-cos.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit the deployment guide**

```bash
git add deploy/README.md src/lib/tencent-cdn-auth.test.ts
git commit -m "docs: add safe CDN authentication rollout"
```

### Task 4: Full verification and handoff

**Files:**
- Verify only; no production file changes expected.

- [ ] **Step 1: Run all Node test files**

Run:

```bash
node --import tsx --test src/lib/*.test.ts src/components/*.test.ts
```

Expected: all discovered tests pass with 0 failures.

- [ ] **Step 2: Run lesson-video static checks**

Run:

```bash
node scripts/check-lesson-video-cos.mjs
node scripts/check-lesson-video-replay.mjs
```

Expected: both scripts exit 0 and print their success messages.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js production build exits 0.

- [ ] **Step 4: Inspect the final diff and configuration safety**

Run:

```bash
git diff origin/main...HEAD -- src/lib/tencent-cdn-auth.ts src/lib/tencent-cdn-auth.test.ts src/lib/lesson-video-storage.ts scripts/check-lesson-video-cos.mjs deploy/README.md
git status --short
```

Expected: only planned files plus the approved design and plan are committed; unrelated `.workbuddy/` remains untouched and uncommitted.

- [ ] **Step 5: Commit any verification-only correction if required**

If verification required a code correction, stage only the affected planned files and commit:

```bash
git add src/lib/tencent-cdn-auth.ts src/lib/tencent-cdn-auth.test.ts src/lib/lesson-video-storage.ts scripts/check-lesson-video-cos.mjs deploy/README.md
git commit -m "fix: complete CDN authentication verification"
```

If no correction was needed, do not create an empty commit.
