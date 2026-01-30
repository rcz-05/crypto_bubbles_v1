import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Aligns with Vercel outputFileTracingRoot (/vercel/path0) when root dir is /web
    root: "..",
  },
};

export default nextConfig;
