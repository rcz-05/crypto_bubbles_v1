import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: "CoinCanvas — guided crypto canvas",
    short_name: "CoinCanvas",
    description:
      "A guided crypto market canvas for beginners who want context before action.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "en",
    dir: "ltr",
    background_color: "#f3efe5",
    theme_color: "#f3efe5",
    categories: ["finance", "education"],
    icons: [
      // /icon → 192×192 (Next.js convention from app/icon.tsx)
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      // /icon0 → 512×512 (Next.js convention from app/icon0.tsx)
      {
        src: "/icon0",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Re-list 512 as maskable. The current design has a generous safe zone
      // (the brand-dot is centered and ~48% of canvas), so the same asset
      // works for both purposes without distortion under Android's mask.
      {
        src: "/icon0",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
