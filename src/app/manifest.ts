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
    // 起動画面はアイコンと同じ色にして、アイコンから画面へつながって見えるようにする
    background_color: "#6246d8",
    // 画面の上端は layout.tsx の themeColor (ライト / ダーク) に合わせる
    theme_color: "#f6f6f7",
    categories: ["news", "productivity"],
    // 画像は scripts/icons.mjs で public/logo.svg から作る
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
  };
}
