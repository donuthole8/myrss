"use client";

import { useState } from "react";

type IconProps = { className?: string };

const base = "h-4 w-4";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? base}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Refresh: (p: IconProps) => (
    <Svg {...p}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Star: ({ filled, ...p }: IconProps & { filled?: boolean }) => (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
      className={p.className ?? base}
    >
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85z" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Svg>
  ),
  CheckAll: (p: IconProps) => (
    <Svg {...p}>
      <path d="m2 13 4 4 8-9" />
      <path d="m12 16 1.5 1.5L22 8" />
    </Svg>
  ),
  External: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  Rss: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Inbox: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
    </Svg>
  ),
  X: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v10M8 11l4 4 4-4" />
      <path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
    </Svg>
  ),
  Upload: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20V10M8 13l4-4 4 4" />
      <path d="M4 6V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1" />
    </Svg>
  ),
  ThumbDown: (p: IconProps) => (
    <Svg {...p}>
      <path d="M17 14V4" />
      <path d="M9 18.5 10 14H5.5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.7 4H17v10l-4.5 6.2a1.6 1.6 0 0 1-2.9-1z" />
    </Svg>
  ),
  Sparkle: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </Svg>
  ),
  Sliders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  ),
  Pencil: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Svg>
  ),
  Flame: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21a7 7 0 0 0 7-7c0-4-3-6.5-4-10-2.5 1.5-4 4-4 6.5-1-.5-2-1.8-2.2-3C7 9.2 5 11.5 5 14a7 7 0 0 0 7 7z" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  ),
  Translate: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5h9M8.5 3v2M11 5c-1 4-3.5 7-7 9" />
      <path d="M6 9c1.3 2 3.2 3.5 5.5 4.5" />
      <path d="m12 21 4.5-10L21 21M13.6 17.5h5.8" />
    </Svg>
  ),
  Keyboard: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </Svg>
  ),
  PanelRight: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </Svg>
  ),
};

const AVATAR_COLORS = [
  "#e0533d", "#d9822b", "#14915a", "#2d7ff9",
  "#7b5cd6", "#c2418a", "#0f8f8f", "#9a6a2f",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * サイトのファビコンを /api/icon 越しに出す。
 * 取れなければタイトル頭文字のアバターにフォールバックする。
 */
export function FeedIcon({
  siteUrl,
  title,
  size = 18,
  className = "",
}: {
  siteUrl: string;
  title: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (title.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size };

  if (!siteUrl || failed) {
    return (
      <span
        style={{ ...style, background: colorFor(title || siteUrl), fontSize: size * 0.55 }}
        className={`inline-flex shrink-0 items-center justify-center rounded text-white font-semibold select-none ${className}`}
        aria-hidden="true"
      >
        {letter}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/icon?url=${encodeURIComponent(siteUrl)}`}
      alt=""
      style={style}
      className={`shrink-0 rounded object-contain dark:bg-white/90 ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

/** 機械翻訳したタイトルの目印。原文と取り違えないように、訳の前に必ず付ける */
export function TranslatedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="DeepL で日本語に翻訳したタイトル"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded bg-accent-soft px-1 py-px align-middle text-[10px] font-semibold leading-tight text-accent ${className}`}
    >
      <Icon.Translate className="h-2.5 w-2.5" />訳
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
