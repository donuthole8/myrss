import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Coffeed — 珈琲1杯ぶんの情報収集",
    short_name: "Coffeed",
    description: "珈琲を飲んでいるあいだに、購読したフィードの新着と話題をまとめて読むRSSリーダー",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0d0f13",
    theme_color: "#6246d8",
    categories: ["news", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
