import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "vod-node-sdk",
      "tencentcloud-sdk-nodejs",
      "cos-nodejs-sdk-v5",
    ],
  },
};

export default nextConfig;
