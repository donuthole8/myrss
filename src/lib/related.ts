import { words } from "./prefer";
import type { Article } from "./types";

/**
 * 関連記事。タイトル (訳を含む) と要約の語を TF-IDF で重み付けし、コサイン類似度で並べる。
 * 同じ話題として束ねるほど似てはいないが、同じ技術・製品・人を扱う記事を拾うのが目的。
 * どこにも出る語は IDF で自然に効かなくなる。
 */

/** これより似ていない記事は出さない */
const MIN_SCORE = 0.22;
/** 1語だけ重なる記事は、たまたま同じ製品名が出ただけのことが多い */
const MIN_SHARED = 2;
/** これより多くの記事に出る語は、候補を集める手がかりにしない (計算量を抑えるため) */
const COMMON_SHARE = 0.05;

type Vector = Map<string, number>;

export type RelatedIndex = {
  vectors: Map<string, Vector>;
  postings: Map<string, string[]>;
  byId: Map<string, Article>;
  commonLimit: number;
};

/** ニュースの見出しにどこでも出る語。話題の近さの手がかりにならない */
const GENERIC = new Set([
  "提供", "開始", "発表", "公開", "リリース", "対応", "追加", "紹介", "正式", "実現", "検証",
  "開発", "機能", "新機能", "利用", "可能", "最新", "解説", "入門", "向け", "作成", "構築",
  "活用", "導入", "登場", "実装", "搭載", "強化", "変更", "版", "年", "月", "日", "話", "件",
  "release", "released", "introducing", "announcing", "launch", "launches", "update", "using",
  "build", "building", "support", "now", "available", "first", "open", "source", "same",
  "here", "anyway", "running", "way", "things", "make", "get",
]);

/** HN などが要約に入れる定型文 (Article URL / Comments URL / Points) と URL を落とす */
function cleanSummary(summary: string): string {
  return summary
    .slice(0, 300)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(Article URL|Comments URL|Points|# Comments):?/gi, " ");
}

function tokensOf(article: Article, translated?: string): string[] {
  const title = [...words(article.title), ...(translated ? words(translated) : [])];
  // タイトルの語を要約の語より重く見る
  const all = [...title, ...title, ...words(cleanSummary(article.summary))];
  return all.filter((t) => !GENERIC.has(t) && !/^\d/.test(t));
}

export function buildRelatedIndex(
  articles: Article[],
  titleJa: (article: Article) => string | undefined,
): RelatedIndex {
  const byId = new Map<string, Article>();
  for (const a of articles) if (!byId.has(a.id)) byId.set(a.id, a);

  const counts = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  for (const a of byId.values()) {
    const tf = new Map<string, number>();
    for (const t of tokensOf(a, titleJa(a))) tf.set(t, (tf.get(t) ?? 0) + 1);
    counts.set(a.id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const n = byId.size;
  const vectors = new Map<string, Vector>();
  const postings = new Map<string, string[]>();
  for (const [id, tf] of counts) {
    const vec: Vector = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const df1 = df.get(t)!;
      // 1記事にしか出ない語は他と比べようがない
      if (df1 < 2) continue;
      const w = (1 + Math.log(c)) * Math.log(n / df1);
      if (w <= 0) continue;
      vec.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm);
    for (const [t, w] of vec) {
      vec.set(t, w / norm);
      const list = postings.get(t);
      if (list) list.push(id);
      else postings.set(t, [id]);
    }
    vectors.set(id, vec);
  }
  return { vectors, postings, byId, commonLimit: Math.max(20, n * COMMON_SHARE) };
}

/**
 * @param exclude 同じストーリーの記事など、関連記事として出さないID
 */
export function relatedTo(
  index: RelatedIndex,
  article: Article,
  exclude: Set<string>,
  limit = 5,
): Article[] {
  const mine = index.vectors.get(article.id);
  if (!mine || mine.size === 0) return [];

  const scores = new Map<string, { score: number; shared: number }>();
  for (const [t, w] of mine) {
    const list = index.postings.get(t)!;
    if (list.length > index.commonLimit) continue;
    for (const id of list) {
      if (id === article.id || exclude.has(id)) continue;
      const hit = scores.get(id) ?? { score: 0, shared: 0 };
      hit.score += w * index.vectors.get(id)!.get(t)!;
      hit.shared += 1;
      scores.set(id, hit);
    }
  }

  const seenTitles = new Set([article.title]);
  return [...scores]
    .filter(([, s]) => s.score >= MIN_SCORE && s.shared >= MIN_SHARED)
    .map(([id, s]) => [id, s.score] as const)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => index.byId.get(id)!)
    // 同じタイトルの転載 (Qiita の複数タグなど) は1件に
    .filter((a) => (seenTitles.has(a.title) ? false : (seenTitles.add(a.title), true)))
    .slice(0, limit);
}
