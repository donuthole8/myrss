"use client";

import dynamic from "next/dynamic";

/**
 * 購読状態は localStorage にしか無いので、サーバーで描いても意味がない。
 * ssr:false にして初期 state を localStorage から直接組み立てる。
 */
const Reader = dynamic(() => import("./Reader").then((m) => m.Reader), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-sm text-muted">読み込み中…</div>
  ),
});

export function ReaderShell() {
  return <Reader />;
}
