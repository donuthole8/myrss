import type { Importance } from "./importance";
import type { Article } from "./types";

/**
 * 今日の N 本。未読のうち新しいものから、好み・話題度・マイスタックへの関わりで点を付けて上位だけを選ぶ。
 * 選んだ記事はその日のあいだ固定する。読むたびに次の記事が繰り上がると、いつまでも読み終わらないので。
 */

const HOUR = 60 * 60 * 1000;
/** 日付の切り替わり。夜ふかしして読んでも前の日の分として扱う */
const DAY_STARTS_AT_HOUR = 4;
/** 候補にする記事の新しさ */
export const TODAY_WINDOW_MS = 48 * HOUR;
/** 同じフィードから選ぶのはここまで。1つの配信元で埋まらないように */
const PER_FEED_MAX = 3;
/** 「もう少し読む」で足す本数 */
export const MORE_COUNT = 5;

export const DAILY_COUNTS = [10, 15, 20] as const;
export type DailyCount = (typeof DAILY_COUNTS)[number];

export type TodayPick = {
  /** dayKey の値 */
  day: string;
  /** フィードから流れ落ちても読めるように、記事ごと持つ */
  articles: Article[];
  /** 記事ID -> 選んだ理由 */
  reasons: Record<string, string[]>;
};

export function dayKey(now: number): string {
  const d = new Date(now - DAY_STARTS_AT_HOUR * HOUR);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type Signals = {
  /** 好みの学習と興味ワードによる点 (Reader の scores) */
  preference: number;
  /** 話題度 (heatOf) */
  heat: number;
  /** 何ソースで取り上げられたか */
  sources: number;
  importance: Importance;
  /** 当てはまったマイスタックの名前 */
  stack: string[];
  /** 当てはまった興味ワード */
  interest: string[];
  /** 好みの学習でいちばん効いた語 */
  liked: string | null;
  ageHours: number;
};

export function rank(s: Signals): { score: number; reasons: string[] } {
  const { importance: imp } = s;
  const inStack = s.stack.length > 0;
  let score = s.preference + Math.min(s.heat, 12) * 0.45 - (s.ageHours / 24) * 0.6;
  const reasons: string[] = [];

  if (imp.security) {
    score += inStack ? 12 : 3;
    reasons.push("セキュリティ");
  }
  if (inStack) {
    score += 3 + (s.stack.length - 1) * 0.5;
    reasons.push(`マイスタック: ${s.stack.slice(0, 2).join("・")}`);
  }
  if (imp.release === "major") {
    score += inStack ? 5 : 1;
    reasons.push("メジャーリリース");
  } else if (imp.breaking) {
    score += inStack ? 4 : 0.5;
    reasons.push("破壊的変更");
  } else if (!imp.security && (imp.release === "patch" || imp.release === "pre")) {
    // パッチ版とプレリリースは、困っている人以外は後で読めば足りる
    score -= 4;
  }
  if (s.sources >= 2) reasons.push(`${s.sources}ソースで話題`);
  else if (s.heat >= 6) reasons.push("話題");
  if (s.interest.length > 0) reasons.push(`興味: ${s.interest[0]}`);
  else if (s.liked) reasons.push(`よく読む: ${s.liked}`);
  return { score, reasons: reasons.slice(0, 3) };
}

/** 点の高い順に、同じフィードに偏らないように count 本選ぶ */
export function pick(
  candidates: Array<{ article: Article; score: number; reasons: string[] }>,
  count: number,
  already: Article[] = [],
): Array<{ article: Article; reasons: string[] }> {
  const perFeed = new Map<string, number>();
  for (const a of already) perFeed.set(a.feedUrl, (perFeed.get(a.feedUrl) ?? 0) + 1);
  const taken = new Set(already.map((a) => a.id));
  const chosen: Array<{ article: Article; reasons: string[] }> = [];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  for (const c of sorted) {
    if (chosen.length >= count) break;
    if (taken.has(c.article.id)) continue;
    const n = perFeed.get(c.article.feedUrl) ?? 0;
    if (n >= PER_FEED_MAX) continue;
    perFeed.set(c.article.feedUrl, n + 1);
    taken.add(c.article.id);
    chosen.push({ article: c.article, reasons: c.reasons });
  }
  return chosen;
}

function isArticle(value: unknown): value is Article {
  return !!value && typeof value === "object" && typeof (value as Article).id === "string";
}

export function parseTodayPick(value: unknown): TodayPick | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<TodayPick>;
  if (typeof v.day !== "string" || !Array.isArray(v.articles)) return null;
  const reasons: Record<string, string[]> = {};
  if (v.reasons && typeof v.reasons === "object") {
    for (const [id, list] of Object.entries(v.reasons)) {
      if (Array.isArray(list)) reasons[id] = list.filter((r): r is string => typeof r === "string");
    }
  }
  return { day: v.day, articles: v.articles.filter(isArticle), reasons };
}
