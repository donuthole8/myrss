import type { Article } from "./types";

/**
 * 好みの学習。スター / 開いた記事を「好き」、興味なし / 開かずに一括既読を「好きでない」として、
 * タイトルと要約の単語で多項ナイーブベイズを組む。外部APIは使わずブラウザ内で完結する。
 * 単語分割は Intl.Segmenter (ブラウザ内蔵の辞書) に任せる。
 */

const MODEL_KEY = "feedly-clone:model:v1";
const MAX_VOCAB = 4000;
/** これだけ学習が溜まるまでは並べ替えだけにして、隠すことはしない */
const MIN_EVENTS = 5;

export type Model = {
  /** token -> [好き, 好きでない] の重み付き出現数 */
  tokens: Record<string, [number, number]>;
  /** クラスごとの総単語数 (重み込み) */
  totals: [number, number];
  /** 学習に使った記事数 */
  events: [number, number];
};

export const SIGNAL = {
  open: { label: 0, weight: 1 },
  star: { label: 0, weight: 2 },
  dislike: { label: 1, weight: 3 },
  skip: { label: 1, weight: 0.5 },
} as const;
export type Signal = keyof typeof SIGNAL;

export function emptyModel(): Model {
  return { tokens: {}, totals: [0, 0], events: [0, 0] };
}

export function loadModel(): Model {
  try {
    const raw = window.localStorage.getItem(MODEL_KEY);
    if (!raw) return emptyModel();
    const parsed = JSON.parse(raw) as Model;
    if (!parsed || typeof parsed.tokens !== "object" || !Array.isArray(parsed.totals)) {
      return emptyModel();
    }
    return {
      tokens: parsed.tokens,
      totals: parsed.totals,
      events: Array.isArray(parsed.events) ? parsed.events : [0, 0],
    };
  } catch {
    return emptyModel();
  }
}

export function saveModel(model: Model): void {
  try {
    window.localStorage.setItem(MODEL_KEY, JSON.stringify(model));
  } catch {
    /* 容量オーバーなら学習結果は捨てて構わない */
  }
}

/* ---------- 単語分割 ---------- */

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "word" })
    : null;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was",
  "be", "by", "at", "as", "it", "its", "this", "that", "from", "how", "what", "why", "you",
  "your", "we", "our", "i", "my", "new", "vs", "via", "can", "will", "not", "do", "does",
  "show", "hn", "ask",
  "する", "した", "して", "こと", "もの", "ため", "よう", "これ", "それ", "について", "として",
  "できる", "ない", "やっ", "みた", "やってみた", "方法", "記事", "まとめ",
]);
const ONLY_HIRAGANA = /^[\p{Script=Hiragana}ー]+$/u;
const HAS_LETTER = /[\p{L}]/u;

export function words(text: string): string[] {
  const lower = text.toLowerCase();
  const raw = segmenter
    ? [...segmenter.segment(lower)].filter((s) => s.isWordLike).map((s) => s.segment)
    : lower.split(/[^\p{L}\p{N}]+/u);
  return raw.filter(
    (w) =>
      w.length > 1 &&
      w.length <= 30 &&
      HAS_LETTER.test(w) &&
      !ONLY_HIRAGANA.test(w) &&
      !STOPWORDS.has(w),
  );
}

const tokenCache = new Map<string, string[]>();

/** 記事の特徴。翻訳タイトルがあれば混ぜて、日本語の興味ワードとも噛み合うようにする */
export function featuresOf(article: Article, translated?: string): string[] {
  const cacheKey = `${article.id}\n${translated ?? ""}`;
  const hit = tokenCache.get(cacheKey);
  if (hit) return hit;
  const tokens = [
    ...words(article.title),
    ...(translated ? words(translated) : []),
    ...words(article.summary.slice(0, 160)),
    `feed:${article.feedUrl}`,
  ];
  const unique = [...new Set(tokens)];
  if (tokenCache.size > 5000) tokenCache.clear();
  tokenCache.set(cacheKey, unique);
  return unique;
}

/* ---------- 学習と採点 ---------- */

export function learn(model: Model, features: string[], signal: Signal): Model {
  const { label, weight } = SIGNAL[signal];
  const tokens = { ...model.tokens };
  for (const t of features) {
    const prev = tokens[t] ?? [0, 0];
    const next: [number, number] = [prev[0], prev[1]];
    next[label] += weight;
    tokens[t] = next;
  }
  const totals: [number, number] = [...model.totals];
  totals[label] += weight * features.length;
  const events: [number, number] = [...model.events];
  events[label] += 1;
  return prune({ tokens, totals, events });
}

/** 語彙が膨らみすぎたら出現の少ない語から捨てる */
function prune(model: Model): Model {
  const entries = Object.entries(model.tokens);
  if (entries.length <= MAX_VOCAB) return model;
  entries.sort((a, b) => b[1][0] + b[1][1] - (a[1][0] + a[1][1]));
  return { ...model, tokens: Object.fromEntries(entries.slice(0, Math.floor(MAX_VOCAB * 0.8))) };
}

export function isTrained(model: Model): boolean {
  return model.events[0] >= MIN_EVENTS && model.events[1] >= MIN_EVENTS;
}

/**
 * 既知語の対数尤度比の和を √語数 で割ったもの。0 より上なら「好き」寄り。
 * 事前確率は入れない (一括既読で「好きでない」側ばかり増えるので、入れると全部が沈む)。
 */
export function scoreOf(model: Model, features: string[]): number {
  const vocab = Object.keys(model.tokens).length + 1;
  const [posTotal, negTotal] = model.totals;
  let sum = 0;
  let known = 0;
  for (const t of features) {
    const counts = model.tokens[t];
    if (!counts) continue;
    known += 1;
    sum +=
      Math.log((counts[0] + 1) / (posTotal + vocab)) -
      Math.log((counts[1] + 1) / (negTotal + vocab));
  }
  return known === 0 ? 0 : sum / Math.sqrt(known);
}

/* ---------- キーワード ---------- */

/** 改行・カンマ区切りの入力をキーワード配列に */
export function parseKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,、]/)
        .map((w) => w.trim())
        .filter(Boolean),
    ),
  ];
}

export function matchesAny(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

/** 興味ワード1つにつき上乗せする点 */
export const INTEREST_BOOST = 1.5;
/** おすすめ表示でこれを下回る記事は隠す */
export const HIDE_BELOW = -1;
