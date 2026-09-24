"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { PULL_TRIGGER_PX, useHorizontalSwipe, usePullToRefresh } from "@/lib/gestures";
import type { Density, SortMode } from "@/lib/store";
import type { Rising } from "@/lib/trends";
import type { Article, Buzz } from "@/lib/types";
import { FeedIcon, Icon, Spinner, TranslatedBadge } from "./ui";

/** 記事に付ける目印。danger はセキュリティ修正など見逃すと困るものだけに使う */
export type Label = { text: string; tone: "danger" | "accent" | "muted"; title?: string };

/** 今日の N 本の進み具合 */
export type TodayProgress = {
  read: number;
  total: number;
  /** もう何本か足す。足せる記事が無ければ null */
  onMore: (() => void) | null;
  onRepick: () => void;
};

const SORT_LABEL: Record<SortMode, string> = {
  latest: "新着順",
  recommended: "おすすめ",
  buzz: "話題順",
};

type Props = {
  title: string;
  articles: Article[];
  selectedId: string | null;
  onSelect: (article: Article) => void;
  /** 訳があれば返す */
  translatedTitle: (article: Article) => string | undefined;
  isRead: (id: string) => boolean;
  isStarred: (id: string) => boolean;
  onToggleStar: (article: Article) => void;
  onToggleRead: (article: Article) => void;
  /** 同じ話題を取り上げている他のフィード名 */
  sourcesOf: (article: Article) => string[];
  buzzOf: (article: Article) => Buzz | undefined;
  /** 急上昇キーワード。null なら出さない */
  keywords: Rising[] | null;
  onPickKeyword: (term: string) => void;
  onRefresh: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  onMarkAllRead: () => void;
  /** null ならこのビューでは並べ替えを出さない (スター付きなど) */
  sort: SortMode | null;
  onToggleSort: () => void;
  /** ミュート・低評価で隠した件数 */
  hiddenCount: number;
  /** 学習が足りないうちは [好き, 好きでない] の件数、足りていれば null */
  training: [number, number] | null;
  loading: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
  onOpenNav: () => void;
  density: Density;
  /** 空のときに出す「おすすめから探す」 */
  onBrowseCatalog: () => void;
  /** セキュリティ・メジャーリリース・マイスタックなどの目印 */
  labelsOf: (article: Article) => Label[];
  /** 今日の N 本で、選んだ理由 */
  reasonsOf?: (article: Article) => string[] | undefined;
  /** 今日の N 本を見ているときだけ渡す */
  today?: TodayProgress | null;
};

export function ArticleList({
  title,
  articles,
  selectedId,
  onSelect,
  translatedTitle,
  isRead,
  isStarred,
  onToggleStar,
  onToggleRead,
  sourcesOf,
  buzzOf,
  keywords,
  onPickKeyword,
  onRefresh,
  query,
  onQueryChange,
  unreadOnly,
  onToggleUnreadOnly,
  onMarkAllRead,
  sort,
  onToggleSort,
  hiddenCount,
  training,
  loading,
  searchRef,
  className = "",
  onOpenNav,
  density,
  onBrowseCatalog,
  labelsOf,
  reasonsOf,
  today = null,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const learning = sort === "recommended" ? training : null;
  const [searchFocused, setSearchOpen] = useState(false);
  // 急上昇キーワードを選んだときなど、外から検索語が入ったときも開いておく
  const searchOpen = searchFocused || query !== "";
  const pullRef = useRef<HTMLDivElement>(null);
  const pull = usePullToRefresh({
    scroller: listRef,
    disabled: loading,
    onRefresh,
    onPull: (px) => {
      const el = pullRef.current;
      if (!el) return;
      el.style.height = `${px}px`;
      el.style.transition = px === 0 ? "height 180ms ease" : "none";
      el.dataset.ready = px >= PULL_TRIGGER_PX ? "1" : "0";
    },
  });

  // キーボードで選択が動いたときに見える位置まで送る
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-article-id="${CSS.escape(selectedId)}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className={`flex w-full shrink-0 flex-col border-r border-line bg-surface md:w-[380px] lg:w-[420px] ${className}`}>
      <header className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="フィード一覧を開く"
          className="-my-1.5 -ml-2 shrink-0 rounded-lg p-2 text-muted hover:bg-line/60 hover:text-ink md:hidden"
        >
          <Icon.Menu className="h-5 w-5" />
        </button>

        {/* 検索欄は普段たたんでおき、虫眼鏡か / で開く。/ でフォーカスできるよう入力欄は常に置いておく */}
        <div className={searchOpen ? "relative min-w-0 flex-1" : "sr-only"}>
          <Icon.Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              onQueryChange("");
              setSearchOpen(false);
              e.currentTarget.blur();
            }}
            placeholder="記事を検索"
            type="search"
            enterKeyHint="search"
            className="w-full rounded-lg border border-line bg-surface-2 py-1 pl-8 pr-2 text-ui outline-none placeholder:text-muted focus:border-accent"
          />
        </div>
        {!searchOpen && (
          <>
            <h2 className="min-w-0 truncate text-title font-semibold tracking-tight">{title}</h2>
            <span
              className="shrink-0 text-2xs tabular-nums text-muted"
              title={hiddenCount > 0 ? `ほかに${hiddenCount}件を非表示（ミュート・興味の薄い記事）` : undefined}
            >
              {articles.length}
            </span>
            {loading && <Spinner className="h-3.5 w-3.5 shrink-0 text-muted" />}
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              title="記事を検索 (/)"
              aria-label="記事を検索"
              className="ml-auto shrink-0 rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-ink"
            >
              <Icon.Search className="h-4 w-4" />
            </button>
          </>
        )}

        {/* 絞り込みと並べ替えは1つの塊にまとめる */}
        <div className="flex shrink-0 rounded-lg border border-line bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={onToggleUnreadOnly}
            title="未読のみ表示 (U)"
            aria-pressed={unreadOnly}
            className={`whitespace-nowrap rounded-md px-2 py-1 text-2xs font-medium transition-colors ${
              unreadOnly ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            未読
          </button>
          {sort && (
            <button
              type="button"
              onClick={onToggleSort}
              title={[
                "並べ替え: 新着順 → おすすめ → 話題順 (P)",
                learning &&
                  `好みを学習中（気になる ${Math.min(learning[0], 5)}/5・興味なし ${Math.min(learning[1], 5)}/5）。記事を開く・スターで「気になる」、D で「興味なし」として覚えます。`,
              ]
                .filter(Boolean)
                .join("\n")}
              className={`flex items-center gap-0.5 whitespace-nowrap rounded-md px-2 py-1 text-2xs font-medium transition-colors ${
                sort !== "latest" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {SORT_LABEL[sort]}
              {learning && <span className="h-1 w-1 rounded-full bg-current opacity-60" aria-label="学習中" />}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          title="表示中をすべて既読にする"
          aria-label="表示中をすべて既読にする"
          className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-ink"
        >
          <Icon.CheckAll className="h-4 w-4" />
        </button>
      </header>

      <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto overscroll-y-contain" {...pull}>
        <div
          ref={pullRef}
          data-ready="0"
          className="group/pull flex h-0 items-end justify-center overflow-hidden text-2xs text-muted"
          aria-hidden="true"
        >
          <span className="flex items-center gap-1.5 pb-2">
            <Icon.Refresh className="h-3.5 w-3.5 transition-transform group-data-[ready=1]/pull:rotate-180" />
            <span className="group-data-[ready=1]/pull:hidden">引っ張って更新</span>
            <span className="hidden group-data-[ready=1]/pull:inline">離すと更新</span>
          </span>
        </div>

        {keywords && keywords.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 pt-2.5 [scrollbar-width:none]">
            <span className="flex shrink-0 items-center gap-1 self-center text-2xs font-semibold text-muted">
              <Icon.Flame className="h-3 w-3" />
              急上昇
            </span>
            {keywords.map((k) => {
              const active = query.trim().toLowerCase() === k.term;
              return (
                <button
                  key={k.term}
                  type="button"
                  onClick={() => onPickKeyword(active ? "" : k.term)}
                  title={`直近2日で ${k.recent} 件（ふだんは ${k.baseline.toFixed(1)} 件ほど）`}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-2xs transition-colors ${
                    active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface-2 text-ink/80 hover:border-accent"
                  }`}
                >
                  {k.term}
                  <span className="ml-1 tabular-nums text-muted">{k.recent}</span>
                </button>
              );
            })}
          </div>
        )}

        {today && today.total > 0 && <TodayHeader today={today} />}

        {articles.length === 0 && loading && <SkeletonRows density={density} />}

        {articles.length === 0 && !loading && !today && (
          <EmptyState
            query={query}
            unreadOnly={unreadOnly}
            onClearQuery={() => onQueryChange("")}
            onShowAll={onToggleUnreadOnly}
            onBrowseCatalog={onBrowseCatalog}
          />
        )}

        {articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            translated={translatedTitle(article)}
            read={isRead(article.id)}
            starred={isStarred(article.id)}
            selected={article.id === selectedId}
            sources={sourcesOf(article)}
            buzz={buzzOf(article)}
            labels={labelsOf(article)}
            reasons={reasonsOf?.(article)}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
            onToggleRead={onToggleRead}
            compact={density === "compact"}
          />
        ))}

        {today && <TodayFooter today={today} loading={loading} />}
      </div>
    </section>
  );
}

/** スワイプでここまで引いたら操作する */
const SWIPE_TRIGGER_PX = 72;

function ArticleRow({
  article,
  translated,
  read,
  starred,
  selected,
  sources,
  buzz,
  labels,
  reasons,
  onSelect,
  onToggleStar,
  onToggleRead,
  compact,
}: {
  article: Article;
  translated: string | undefined;
  read: boolean;
  starred: boolean;
  selected: boolean;
  sources: string[];
  buzz: Buzz | undefined;
  labels: Label[];
  reasons: string[] | undefined;
  onSelect: (article: Article) => void;
  onToggleStar: (article: Article) => void;
  onToggleRead: (article: Article) => void;
  compact: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  // 右へ: スター、左へ: 既読 / 未読
  const swipe = useHorizontalSwipe({
    onMove: (x) => {
      setSettling(false);
      // 引くほど重くして、行き過ぎないようにする
      const abs = Math.abs(x);
      const eased = abs <= SWIPE_TRIGGER_PX ? abs : SWIPE_TRIGGER_PX + (abs - SWIPE_TRIGGER_PX) * 0.3;
      setDx(Math.sign(x) * eased);
    },
    onEnd: (x) => {
      setSettling(true);
      setDx(0);
      if (x >= SWIPE_TRIGGER_PX) onToggleStar(article);
      else if (x <= -SWIPE_TRIGGER_PX) onToggleRead(article);
      else return;
      navigator.vibrate?.(8);
    },
  });
  const armed = Math.abs(dx) >= SWIPE_TRIGGER_PX;

  return (
    <div className="relative mx-2 my-0.5 overflow-hidden rounded-xl">
      {dx !== 0 && (
        <div
          className={`absolute inset-0 flex items-center px-5 text-xs font-semibold transition-colors ${
            dx > 0 ? "justify-start" : "justify-end"
          } ${
            armed ? (dx > 0 ? "bg-star text-white" : "bg-accent text-accent-ink") : "bg-line/60 text-muted"
          }`}
          aria-hidden="true"
        >
          {dx > 0 ? (
            <span className="flex items-center gap-1.5">
              <Icon.Star filled={!starred} className="h-4 w-4" />
              {starred ? "スターを外す" : "スター"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {read ? "未読に戻す" : "既読にする"}
              <Icon.Check className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
      <article
        data-article-id={article.id}
        onClick={() => {
          if (swipe.consumeClick()) return;
          onSelect(article);
        }}
        {...swipe.handlers}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: settling ? "transform 180ms ease" : undefined,
        }}
        onTransitionEnd={() => setSettling(false)}
        className={`group relative cursor-pointer touch-pan-y rounded-xl px-3 transition-colors ${
          compact ? "py-2" : "py-3"
        } ${selected ? "bg-accent-soft" : "bg-surface hover:bg-surface-2"}`}
      >
        <div className="flex items-center gap-1.5 text-2xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={13} />
            <span className="truncate">{article.feedTitle}</span>
            <span className="shrink-0">·</span>
            <time className="shrink-0 tabular-nums">{relativeTime(article.publishedAt)}</time>
          </span>
          {/* 付けるのはスワイプ・S キー・記事側のボタンで。ここでは付いていることだけ示す */}
          {starred && (
            <span className="ml-auto shrink-0 text-star" title="スター付き" aria-label="スター付き">
              <Icon.Star filled className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {/* 未読・既読の差はタイトルだけで示す。未読は点と太字、既読は細字で色を落とす */}
            <div>
              <h3
                className={`mt-0.5 line-clamp-2 text-sm leading-snug ${
                  read ? "font-normal text-ink/60" : "font-semibold text-ink"
                }`}
              >
                {!read && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-accent align-middle" />}
                {translated && <TranslatedBadge size={15} className="mr-1.5 -translate-y-px" />}
                {translated ?? article.title}
              </h3>

              {labels.length > 0 && <LabelLine labels={labels} />}
              {!compact && <BuzzLine sources={sources} buzz={buzz} compact />}
              {reasons && reasons.length > 0 && (
                <p className="mt-1 truncate text-2xs text-muted" title="今日の分に選んだ理由">
                  {reasons.join(" · ")}
                </p>
              )}
            </div>
          </div>

          {!compact && article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt=""
              loading="lazy"
              className="mt-1 h-16 w-16 shrink-0 rounded-lg bg-surface-2 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      </article>
    </div>
  );
}

const LABEL_TONE: Record<Label["tone"], string> = {
  danger: "bg-danger/10 text-danger font-semibold",
  accent: "bg-accent-soft text-accent font-medium",
  muted: "bg-line/60 text-muted",
};

function LabelLine({ labels }: { labels: Label[] }) {
  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1 text-2xs">
      {labels.map((l) => (
        <span key={l.text} title={l.title} className={`shrink-0 rounded px-1.5 py-px ${LABEL_TONE[l.tone]}`}>
          {l.text}
        </span>
      ))}
    </div>
  );
}

function TodayHeader({ today }: { today: TodayProgress }) {
  const done = today.read >= today.total;
  return (
    <div className="mx-4 mb-1 mt-3">
      <div className="flex items-center gap-2 text-2xs text-muted">
        <span className="tabular-nums">
          {done ? "今日の分は読み終わりました" : `${today.read} / ${today.total} 本 読了`}
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("今日の分を選び直しますか？（読んだ記事は外して選びます）")) today.onRepick();
          }}
          className="ml-auto rounded px-1 hover:text-ink"
          title="いまある記事から選び直す"
        >
          選び直す
        </button>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={today.total}
        aria-valuenow={today.read}
        aria-label="今日の分の進み具合"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.min(100, (today.read / today.total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** 一覧の終わり。読み切ったら区切りを付けて、そこで閉じてよいと伝える */
function TodayFooter({ today, loading }: { today: TodayProgress; loading: boolean }) {
  if (today.total === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          {loading ? <Spinner className="h-5 w-5" /> : <Icon.Coffee className="h-5 w-5" />}
        </span>
        <p className="mt-3 text-sm font-medium">{loading ? "今日の分を選んでいます" : "新しい記事はまだありません"}</p>
        {!loading && <p className="mt-1 text-xs text-muted">ここ2日の未読がたまったら、ここに並びます。</p>}
      </div>
    );
  }
  const done = today.read >= today.total;
  return (
    <div className="flex flex-col items-center px-6 pb-10 pt-6 text-center">
      {done ? (
        <>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon.Check className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium">今日はここまで</p>
          <p className="mt-1 text-xs text-muted">残りは読まなくても大丈夫です。気になれば「すべての記事」からどうぞ。</p>
        </>
      ) : (
        <p className="text-2xs text-muted">あと {today.total - today.read} 本</p>
      )}
      {today.onMore && (
        <button
          type="button"
          onClick={today.onMore}
          className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          もう少し読む
        </button>
      )}
    </div>
  );
}

/** 数字ごとの「伸びている」とみなす目安 */
const HOT = { hatena: 100, points: 200, likes: 100 };

type Metric = { key: keyof typeof HOT; label: string; value: number; title: string };

function metricsOf(buzz: Buzz | undefined): Metric[] {
  const hatena = buzz?.hatena ?? 0;
  const points = buzz?.points ?? 0;
  const likes = buzz?.likes ?? 0;
  const metrics: Metric[] = [];
  if (hatena >= 3) metrics.push({ key: "hatena", label: "B!", value: hatena, title: "はてなブックマーク数" });
  if (points > 0) {
    const comments = buzz?.comments !== undefined ? `（コメント ${buzz.comments}）` : "";
    metrics.push({ key: "points", label: "▲", value: points, title: `Hacker News のポイント${comments}` });
  }
  if (likes > 0) metrics.push({ key: "likes", label: "♥", value: likes, title: "Qiita / Zenn のいいね数" });
  return metrics;
}

/**
 * 何ソースで話題か・はてブ数・HN ポイント・いいね数。
 * 一覧 (compact) では目安に対していちばん伸びている数字を1つだけ出す
 */
export function BuzzLine({
  sources,
  buzz,
  compact = false,
}: {
  sources: string[];
  buzz: Buzz | undefined;
  compact?: boolean;
}) {
  let metrics = metricsOf(buzz);
  if (compact && metrics.length > 1) {
    metrics = [metrics.reduce((a, b) => (b.value / HOT[b.key] > a.value / HOT[a.key] ? b : a))];
  }
  if (sources.length === 0 && metrics.length === 0) return null;
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-2xs">
      {sources.length > 0 && (
        <span
          className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px font-semibold text-accent"
          title={`${sources.join("、")} でも取り上げられています`}
        >
          {sources.length + 1}ソース
        </span>
      )}
      {metrics.map((m) => (
        <span
          key={m.key}
          className={`shrink-0 tabular-nums ${m.value >= HOT[m.key] ? "font-semibold text-ink" : "text-muted"}`}
          title={m.title}
        >
          {m.label} {m.value.toLocaleString()}
        </span>
      ))}
      {!compact && sources.length > 0 && <span className="truncate text-muted">{sources.join(" · ")}</span>}
    </div>
  );
}

function SkeletonRows({ density }: { density: Density }) {
  return (
    <div className="animate-pulse" aria-label="読み込み中">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className={`mx-2 flex gap-3 px-3 ${density === "compact" ? "py-2.5" : "py-3.5"}`}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-1/3 rounded bg-line" />
            <div className="h-3.5 w-11/12 rounded bg-line" />
          </div>
          {density !== "compact" && i % 2 === 0 && <div className="mt-4 h-16 w-16 shrink-0 rounded-lg bg-line/70" />}
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  query,
  unreadOnly,
  onClearQuery,
  onShowAll,
  onBrowseCatalog,
}: {
  query: string;
  unreadOnly: boolean;
  onClearQuery: () => void;
  onShowAll: () => void;
  onBrowseCatalog: () => void;
}) {
  const { icon, title, note, action, onAction } = query
    ? {
        icon: <Icon.Search className="h-5 w-5" />,
        title: `「${query}」に一致する記事がありません`,
        note: "ことばを変えるか、絞り込みを外してみてください。",
        action: "検索をクリア",
        onAction: onClearQuery,
      }
    : unreadOnly
      ? {
          icon: <Icon.Check className="h-5 w-5" />,
          title: "すべて読みました",
          note: "未読の記事はもうありません。",
          action: "既読も表示する",
          onAction: onShowAll,
        }
      : {
          icon: <Icon.Rss className="h-5 w-5" />,
          title: "記事がありません",
          note: "フィードを追加すると、ここに記事が並びます。",
          action: "おすすめから探す",
          onAction: onBrowseCatalog,
        };
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
      >
        {action}
      </button>
    </div>
  );
}
