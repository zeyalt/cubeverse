import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cube/avatar photos are uploaded via Server Actions; the default 1MB body
    // limit rejects typical phone photos, so raise it to allow them through.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
