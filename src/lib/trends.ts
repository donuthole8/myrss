import { words } from "./prefer";

/**
 * 急上昇キーワード。記事タイトルの語を公開日ごとに数えてブラウザに貯め、
 * 直近2日の出現数が、それより前の1週間の平均からどれだけ跳ねたかで並べる。
 * フィードは最新数十件しか返さないので、貯めておかないと「いつもより多い」が測れない。
 */

const KEY = "feedly-clone:trends:v1";
const MAX_DAYS = 10;
const MAX_SEEN = 6000;
const RECENT_DAYS = 2;
const BASELINE_DAYS = 7;
/** 直近でこれ未満しか出ていない語は候補にしない */
const MIN_RECENT = 3;

export type TrendHistory = {
  /** "2026-09-23" -> 語 -> その日に公開された記事のうち、タイトルに含むものの数 */
  days: Record<string, Record<string, number>>;
  /** 数え済みの記事キー。同じ記事を二度数えないため */
  seen: string[];
};

export type Rising = { term: string; recent: number; baseline: number };

export function emptyHistory(): TrendHistory {
  return { days: {}, seen: [] };
}

export function loadHistory(): TrendHistory {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as TrendHistory) : null;
    if (!parsed || typeof parsed.days !== "object" || !Array.isArray(parsed.seen)) {
      return emptyHistory();
    }
    return parsed;
  } catch {
    return emptyHistory();
  }
}

export function saveHistory(history: TrendHistory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    /* 容量オーバーなら諦める。次の起動でまた貯め直す */
  }
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(now: number, n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return dayKey(d.getTime());
}

/** まだ数えていない記事を足す。何も増えなければ同じオブジェクトを返す */
export function record(
  history: TrendHistory,
  items: Array<{ key: string; title: string; publishedAt: number | null }>,
  now = Date.now(),
): TrendHistory {
  const seen = new Set(history.seen);
  const oldest = daysAgo(now, MAX_DAYS - 1);
  const fresh = items.filter(
    (item) =>
      item.publishedAt !== null &&
      item.publishedAt <= now &&
      dayKey(item.publishedAt) >= oldest &&
      !seen.has(item.key),
  );
  if (fresh.length === 0) return history;

  const days: TrendHistory["days"] = {};
  for (const [day, counts] of Object.entries(history.days)) {
    if (day >= oldest) days[day] = { ...counts };
  }
  const added: string[] = [];
  for (const item of fresh) {
    seen.add(item.key);
    added.push(item.key);
    const day = dayKey(item.publishedAt!);
    const counts = (days[day] ??= {});
    for (const term of new Set(words(item.title))) {
      counts[term] = (counts[term] ?? 0) + 1;
    }
  }
  return { days, seen: [...history.seen, ...added].slice(-MAX_SEEN) };
}

export function rising(history: TrendHistory, now = Date.now(), limit = 12): Rising[] {
  const sum = (from: number, to: number) => {
    const total = new Map<string, number>();
    let daysWithData = 0;
    for (let i = from; i < to; i += 1) {
      const counts = history.days[daysAgo(now, i)];
      if (!counts) continue;
      daysWithData += 1;
      for (const [term, n] of Object.entries(counts)) total.set(term, (total.get(term) ?? 0) + n);
    }
    return { total, daysWithData };
  };

  const recent = sum(0, RECENT_DAYS);
  const base = sum(RECENT_DAYS, RECENT_DAYS + BASELINE_DAYS);
  const scale = RECENT_DAYS / Math.max(1, base.daysWithData);

  const scored: Array<Rising & { score: number }> = [];
  for (const [term, n] of recent.total) {
    if (n < MIN_RECENT || /^\d+$/.test(term)) continue;
    const baseline = (base.total.get(term) ?? 0) * scale;
    scored.push({ term, recent: n, baseline, score: n / (baseline + 1.5) });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.recent - a.recent)
    .slice(0, limit)
    .map(({ term, recent: r, baseline }) => ({ term, recent: r, baseline }));
}
