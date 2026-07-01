/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "vod-node-sdk",
      "tencentcloud-sdk-nodejs",
      "cos-nodejs-sdk-v5",
    ],
  },
};
export default nextConfig;
