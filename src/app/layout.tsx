import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_JP, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// 記事本文用。和文は重いので先読みしない
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Coffeed — 珈琲1杯ぶんの情報収集",
  description: "珈琲を飲んでいるあいだに、購読したフィードの新着と話題をまとめて読むRSSリーダー",
  applicationName: "Coffeed",
  appleWebApp: { capable: true, title: "Coffeed", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  // 個人用なので検索には出さない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // ホーム画面から開いたときにノッチ下まで描画する
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#161618" },
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
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${notoSerifJp.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
