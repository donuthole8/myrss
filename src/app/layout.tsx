import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Reedly — RSSリーダー",
  description: "購読したRSS / Atomフィードをまとめて読むリーダー",
  applicationName: "Reedly",
  appleWebApp: { capable: true, title: "Reedly", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  // 個人用なので検索には出さない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // ホーム画面から開いたときにノッチ下まで描画する
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

/** 初回描画前にテーマを当てて、白→黒のちらつきを消す */
const THEME_BOOTSTRAP = `(function(){try{
  var raw = localStorage.getItem("feedly-clone:v1");
  var pref = raw ? (JSON.parse(raw).prefs || {}).theme : "system";
  var dark = pref === "dark" || ((pref === "system" || !pref) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
