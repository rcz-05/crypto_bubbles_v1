import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoinCanvas",
    short_name: "CoinCanvas",
    description: "A guided crypto market canvas for beginners who want context before action.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe5",
    theme_color: "#f3efe5",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
