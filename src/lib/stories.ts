import { words } from "./prefer";
import type { Article, Buzz } from "./types";

/**
 * 同じ話題を扱う記事を「ストーリー」にまとめる。
 * HN・はてブ・Zenn など別々のフィードに同じ記事が流れてくるのを1件として数え、
 * 何ソースで取り上げられているかを話題度に使う。既読もストーリー単位で共有する。
 */

const HOUR = 60 * 60 * 1000;
/** タイトルが似ているかで束ねるのは、この期間に出た記事どうしだけ */
const TITLE_WINDOW_MS = 72 * HOUR;
const SIMILAR = 0.6;
const MIN_TITLE_TOKENS = 3;
/** これより多くのタイトルに出る語は、似ているかの手がかりにしない */
const COMMON_TOKEN = 40;

const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|yclid|mc_cid|mc_eid|ref|ref_src|cmpid|ncid|rss|feed)$/i;

/** 追跡用パラメータ・www・末尾スラッシュ・http/https の違いを無視した比較用URL */
export function normalizeLink(link: string): string {
  if (!link) return "";
  try {
    const url = new URL(link);
    url.hash = "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/(?=$|\?)/, "");
  } catch {
    return link;
  }
}

export type Story = {
  key: string;
  articles: Article[];
  /** 取り上げたフィードのURL */
  feeds: Set<string>;
  buzz: Buzz;
  /** いちばん早い公開日時 */
  publishedAt: number | null;
};

export type StoryIndex = {
  /** 記事ID -> ストーリーのキー */
  storyOf: Map<string, string>;
  stories: Map<string, Story>;
};

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function maxOf(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/**
 * @param hatena 記事URL -> はてブ数 (/api/buzz で取ったもの)
 */
export function buildStories(
  articles: Article[],
  hatena: Record<string, number>,
  now = Date.now(),
): StoryIndex {
  const n = articles.length;
  const parent = articles.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  // 1. 同じURL (正規化後) は同じ記事
  const byLink = new Map<string, number>();
  articles.forEach((a, i) => {
    const key = normalizeLink(a.link);
    if (!key) return;
    const first = byLink.get(key);
    if (first === undefined) byLink.set(key, i);
    else union(first, i);
  });

  // 2. 別フィードで、最近のタイトルがよく似ていれば同じ話題
  const tokens: Array<Set<string> | null> = articles.map((a) => {
    if (a.publishedAt !== null && now - a.publishedAt > TITLE_WINDOW_MS) return null;
    const set = new Set(words(a.title));
    return set.size >= MIN_TITLE_TOKENS ? set : null;
  });
  const postings = new Map<string, number[]>();
  tokens.forEach((set, i) => {
    if (!set) return;
    for (const t of set) postings.set(t, [...(postings.get(t) ?? []), i]);
  });
  for (let i = 0; i < n; i += 1) {
    const mine = tokens[i];
    if (!mine) continue;
    const candidates = new Set<number>();
    for (const t of mine) {
      const list = postings.get(t)!;
      if (list.length > COMMON_TOKEN) continue;
      for (const j of list) if (j > i) candidates.add(j);
    }
    for (const j of candidates) {
      if (articles[j].feedUrl === articles[i].feedUrl) continue;
      if (jaccard(mine, tokens[j]!) >= SIMILAR) union(i, j);
    }
  }

  const storyOf = new Map<string, string>();
  const stories = new Map<string, Story>();
  articles.forEach((a, i) => {
    const root = articles[find(i)];
    const key = normalizeLink(root.link) || root.id;
    storyOf.set(a.id, key);
    let story = stories.get(key);
    if (!story) {
      story = { key, articles: [], feeds: new Set(), buzz: {}, publishedAt: null };
      stories.set(key, story);
    }
    story.articles.push(a);
    story.feeds.add(a.feedUrl);
    story.buzz = {
      hatena: maxOf(maxOf(story.buzz.hatena, a.buzz?.hatena), a.link ? hatena[a.link] : undefined),
      points: maxOf(story.buzz.points, a.buzz?.points),
      comments: maxOf(story.buzz.comments, a.buzz?.comments),
    };
    if (a.publishedAt !== null) {
      story.publishedAt =
        story.publishedAt === null ? a.publishedAt : Math.min(story.publishedAt, a.publishedAt);
    }
  });
  return { storyOf, stories };
}

/** HN ポイントははてブ数より桁が出やすいので、これで割ってからはてブと同じ物差しに乗せる */
const HN_POINTS_PER_BOOKMARK = 3;

/**
 * 話題度。ソースが1つ増えるごとに大きく足し、ブクマ数・ポイントは対数で効かせる。
 * 古い記事ほど割り引く (1日で約0.57倍、3日で約0.33倍)。
 */
export function heatOf(story: Story, now = Date.now()): number {
  const raw =
    3 * (story.feeds.size - 1) +
    Math.log2(1 + (story.buzz.hatena ?? 0)) +
    Math.log2(1 + (story.buzz.points ?? 0) / HN_POINTS_PER_BOOKMARK);
  const ageHours = story.publishedAt === null ? 48 : Math.max(0, (now - story.publishedAt) / HOUR);
  return raw / Math.pow(1 + ageHours / 24, 0.8);
}

/** 話題ランキングに載せる最低ライン */
export function isHot(story: Story): boolean {
  return (
    story.feeds.size >= 2 ||
    (story.buzz.hatena ?? 0) >= 30 ||
    (story.buzz.points ?? 0) >= 100
  );
}

/** ストーリーの代表記事。本文をいちばん多く持っているもの (HN の転載より元フィードを優先) */
export function leadOf(story: Story): Article {
  return story.articles.reduce((best, a) => (a.content.length > best.content.length ? a : best));
}
