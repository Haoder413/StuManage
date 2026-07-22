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
  if (
    !normalized ||
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
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
