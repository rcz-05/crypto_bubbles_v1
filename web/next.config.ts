import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Use an absolute path to satisfy Vercel warning
    root: process.cwd(),
  },
};

export default nextConfig;
