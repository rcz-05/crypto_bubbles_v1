import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Use an absolute path to satisfy Vercel warning
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
      },
    ],
  },
};

export default nextConfig;
