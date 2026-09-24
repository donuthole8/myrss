import type { Article } from "./types";

/**
 * 記事の重要度の目印。見逃すと困るもの (セキュリティ修正・破壊的変更) を拾い、
 * リリースは版番号からメジャー / マイナー / パッチを見分けて、パッチは目立たせない。
 */

export type ReleaseLevel = "major" | "minor" | "patch" | "pre";

export type Importance = {
  security: boolean;
  breaking: boolean;
  release: ReleaseLevel | null;
};

const SECURITY =
  /\bCVE-\d{4}-\d{4,}\b|\bGHSA-[\w-]+|vulnerabilit|security (fix|release|update|advisory|patch|issue)|remote code execution|\bRCE\b|zero-day|脆弱性|セキュリティ(修正|アップデート|更新|パッチ|アドバイザリ)|ゼロデイ/i;

const BREAKING =
  /breaking change|破壊的変更|deprecat|非推奨|end[- ]of[- ]life|\bEOL\b|サポート終了|drops? support|removed? support/i;

/** GitHub のリリース・タグのフィード */
const RELEASE_FEED = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(releases|tags)\.atom$/;

/** 本文ではなくタイトルでリリースを告げている記事 */
const ANNOUNCE = /release[sd]?\b|リリース|announcing|is out|now available|公開|登場/i;

const VERSION = /\bv?(\d{1,4})\.(\d{1,4})(?:\.(\d{1,5}))?(?:[-.+]?(alpha|beta|rc|preview|pre|dev|canary|nightly|next)[\w.]*)?/i;

/** 「Next.js 16」のように、製品名のあとに大きい番号だけを書くリリース告知 */
const BARE_MAJOR = /\b[A-Z][\w.+-]*\s+v?(\d{1,3})(?![\d.%])/;

/** タイトルの版番号からリリースの大きさを決める。0.x はマイナーが上がると互換が崩れる */
export function releaseLevel(title: string, announced = false): ReleaseLevel | null {
  const m = VERSION.exec(title);
  if (!m) return announced && BARE_MAJOR.test(title) ? "major" : null;
  if (m[4]) return "pre";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3] ?? 0);
  if (patch > 0) return "patch";
  if (major === 0) return minor > 0 ? "major" : "patch";
  return minor === 0 ? "major" : "minor";
}

export function isReleaseFeed(feedUrl: string): boolean {
  return RELEASE_FEED.test(feedUrl);
}

const cache = new Map<string, Importance>();

export function importanceOf(article: Article, titleJa?: string): Importance {
  const key = `${article.id}\n${titleJa ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const heading = `${article.title}\n${titleJa ?? ""}`;
  const releaseFeed = isReleaseFeed(article.feedUrl);
  const announced = ANNOUNCE.test(heading);
  const release = releaseFeed || announced ? releaseLevel(article.title, announced && !releaseFeed) : null;
  // リリースノートは本文にセキュリティ修正が書かれるので要約まで見る。ふつうの記事はタイトルだけ
  const security = SECURITY.test(releaseFeed ? `${heading}\n${article.summary.slice(0, 600)}` : heading);
  const breaking = release === "major" || BREAKING.test(heading);

  const result = { security, breaking, release };
  if (cache.size > 5000) cache.clear();
  cache.set(key, result);
  return result;
}
