import type { Article, Feed } from "./types";

const KEY = "feedly-clone:v1";
const MAX_READ_IDS = 8000;
const MAX_STARRED = 500;

export type Theme = "light" | "dark" | "system";
/** buzz: ソース数・はてブ数・HN ポイントの多い順 */
export type SortMode = "latest" | "recommended" | "buzz";
export const SORT_ORDER: SortMode[] = ["latest", "recommended", "buzz"];

export type Watch = {
  keyword: string;
  /** 一緒に購読した Google ニュース検索のフィード。無ければ null */
  feedUrl: string | null;
};

export const WATCH_FOLDER = "ウォッチ";

export function googleNewsUrl(keyword: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;
}

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
    /** recommended: 学習した好みの順に並べ、明らかに好みでないものは隠す。buzz: 話題の順 */
    sort: SortMode;
    /** 英語などのタイトルを日本語訳で出す */
    translate: boolean;
  };
  filters: {
    /** タイトルに含まれていたら隠す */
    mute: string[];
    /** 含まれていたらおすすめ度を上げる */
    interest: string[];
  };
  watches: Watch[];
};

const DEFAULT_FEEDS: Feed[] = [
  { url: "https://qiita.com/popular-items/feed", title: "Qiita 人気の記事", siteUrl: "https://qiita.com", folder: "テック", addedAt: 0 },
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
    prefs: { theme: "system", unreadOnly: false, sort: "latest", translate: true },
    filters: { mute: [], interest: [] },
    watches: [],
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

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
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
        sort: SORT_ORDER.includes(parsed.prefs?.sort as SortMode) ? parsed.prefs!.sort : "latest",
        translate: parsed.prefs?.translate !== false,
      },
      filters: {
        mute: stringList(parsed.filters?.mute),
        interest: stringList(parsed.filters?.interest),
      },
      watches: Array.isArray(parsed.watches)
        ? parsed.watches.filter(
            (w): w is Watch =>
              !!w && typeof w.keyword === "string" && w.keyword.length > 0 &&
              (w.feedUrl === null || typeof w.feedUrl === "string"),
          )
        : [],
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

/** フィードが1つも入っていないフォルダを落とす */
export function pruneFolders(folders: string[], feeds: Feed[]): string[] {
  const used = new Set(feeds.map((f) => f.folder).filter(Boolean));
  return folders.filter((f) => used.has(f));
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
