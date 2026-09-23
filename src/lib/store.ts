import type { Article, Feed } from "./types";

const KEY = "feedly-clone:v1";
const MAX_READ_IDS = 8000;
const MAX_STARRED = 500;

export type Theme = "light" | "dark" | "system";

export type Persisted = {
  version: 1;
  feeds: Feed[];
  folders: string[];
  /** 既読の記事ID。古いものから切り捨てる */
  read: string[];
  /** スターは記事ごと保存する。フィードから流れ落ちても残るように */
  starred: Article[];
  prefs: {
    theme: Theme;
    unreadOnly: boolean;
  };
};

const DEFAULT_FEEDS: Feed[] = [
  { url: "https://zenn.dev/feed", title: "Zenn", siteUrl: "https://zenn.dev", folder: "テック", addedAt: 0 },
  { url: "https://b.hatena.ne.jp/hotentry/it.rss", title: "はてブ テクノロジー", siteUrl: "https://b.hatena.ne.jp", folder: "テック", addedAt: 0 },
  { url: "https://www.publickey1.jp/atom.xml", title: "Publickey", siteUrl: "https://www.publickey1.jp", folder: "テック", addedAt: 0 },
  { url: "https://hnrss.org/frontpage", title: "Hacker News", siteUrl: "https://news.ycombinator.com", folder: "Global", addedAt: 0 },
  { url: "https://github.blog/feed/", title: "The GitHub Blog", siteUrl: "https://github.blog", folder: "Global", addedAt: 0 },
];

export function initialState(): Persisted {
  return {
    version: 1,
    feeds: DEFAULT_FEEDS,
    folders: ["テック", "Global"],
    read: [],
    starred: [],
    prefs: { theme: "system", unreadOnly: false },
  };
}

function isFeed(value: unknown): value is Feed {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Feed).url === "string" &&
    (value as Feed).url.length > 0
  );
}

/** localStorage は壊れている前提で読む。読めなければ初期状態に戻す */
export function loadState(): Persisted {
  if (typeof window === "undefined") return initialState();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return initialState();
  }
  if (!raw) return initialState();

  try {
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const feeds = Array.isArray(parsed.feeds) ? parsed.feeds.filter(isFeed) : [];
    const starred = Array.isArray(parsed.starred)
      ? parsed.starred.filter((a): a is Article => !!a && typeof a === "object" && typeof (a as Article).id === "string")
      : [];
    const folders = Array.isArray(parsed.folders)
      ? parsed.folders.filter((f): f is string => typeof f === "string")
      : [];
    return {
      version: 1,
      feeds,
      folders: [...new Set([...folders, ...feeds.map((f) => f.folder).filter(Boolean)])],
      read: Array.isArray(parsed.read) ? parsed.read.filter((id): id is string => typeof id === "string") : [],
      starred,
      prefs: {
        theme: (["light", "dark", "system"] as const).includes(parsed.prefs?.theme as Theme)
          ? (parsed.prefs!.theme as Theme)
          : "system",
        unreadOnly: parsed.prefs?.unreadOnly === true,
      },
    };
  } catch {
    return initialState();
  }
}

export function saveState(state: Persisted): void {
  if (typeof window === "undefined") return;
  const trimmed: Persisted = {
    ...state,
    read: state.read.slice(-MAX_READ_IDS),
    starred: state.starred.slice(0, MAX_STARRED),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // 容量オーバーなら既読IDを削って一度だけ再挑戦する
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ ...trimmed, read: trimmed.read.slice(-1000) }),
      );
    } catch {
      /* それでも駄目なら諦める */
    }
  }
}

export const UNCATEGORIZED = "未分類";

export function folderOf(feed: Feed): string {
  return feed.folder || UNCATEGORIZED;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function subscribeSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}
