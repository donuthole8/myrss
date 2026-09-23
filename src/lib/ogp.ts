import type { Article } from "./types";

/**
 * フィードに画像や要約が無い記事を、元記事の OGP で補う。
 * 結果は記事URLをキーに localStorage へ貯め、同じページを何度も取りに行かない。
 */

export type Ogp = { image?: string; description?: string };

type Entry = Ogp & { at: number };
export type OgpCache = Record<string, Entry>;

const KEY = "feedly-clone:ogp:v1";
const MAX_ENTRIES = 2500;
/** 取れなかったページはこの間は聞き直さない */
const RETRY_MS = 24 * 60 * 60 * 1000;

/** HN の「Article URL: … Comments URL: …」のように、中身を表していない要約 */
export function isThinSummary(article: Article): boolean {
  const s = article.summary.trim();
  return s.length < 30 || /^(Article URL:|Comments URL:)/.test(s) || s === article.title.trim();
}

export function needsOgp(article: Article): boolean {
  return !!article.link && (!article.image || isThinSummary(article));
}

export function loadOgp(): OgpCache {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as OgpCache) : {};
  } catch {
    return {};
  }
}

export function saveOgp(cache: OgpCache): void {
  const entries = Object.entries(cache);
  const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : cache;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* 取り直せるので諦める */
  }
}

/** 取得済み、または失敗して間もないなら聞かない */
export function isKnown(cache: OgpCache, link: string, now = Date.now()): boolean {
  const hit = cache[link];
  if (!hit) return false;
  if (hit.image || hit.description) return true;
  return now - hit.at < RETRY_MS;
}

export function withOgp(article: Article, cache: OgpCache): Article {
  const hit = article.link ? cache[article.link] : undefined;
  if (!hit) return article;
  const image = article.image ?? hit.image ?? null;
  const summary = hit.description && isThinSummary(article) ? hit.description : article.summary;
  if (image === article.image && summary === article.summary) return article;
  return { ...article, image, summary };
}

export async function requestOgp(urls: string[]): Promise<Record<string, Ogp | null> | null> {
  try {
    const res = await fetch("/api/ogp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Record<string, Ogp | null> };
    return data.results ?? null;
  } catch {
    return null;
  }
}
