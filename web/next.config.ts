import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Force build root to the web app to silence multi-lockfile warning on Vercel
    root: __dirname,
  },
};

export default nextConfig;
