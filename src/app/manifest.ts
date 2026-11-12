import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Career Ops by Vish",
    short_name: "Career Ops",
    description: "A local-first job search desk. Score, draft, and track. You still press submit.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#243044",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
