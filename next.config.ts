import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  serverExternalPackages: ["bullmq", "ioredis", "postgres"],
};

export default nextConfig;
