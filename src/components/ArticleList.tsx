"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { PULL_TRIGGER_PX, useHorizontalSwipe, usePullToRefresh } from "@/lib/gestures";
import type { Density, SortMode } from "@/lib/store";
import type { Rising } from "@/lib/trends";
import type { Article, Buzz } from "@/lib/types";
import { FeedIcon, Icon, Spinner, TranslatedBadge } from "./ui";

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
  /** 抜粋の訳があれば返す */
  translatedSummary: (article: Article) => string | undefined;
  /** 抜粋が画面に入った記事。見えた分だけ訳すため */
  onSummariesShown: (articles: Article[]) => void;
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
};

export function ArticleList({
  title,
  articles,
  selectedId,
  onSelect,
  translatedTitle,
  translatedSummary,
  onSummariesShown,
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
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const learning = sort === "recommended" ? training : null;
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

  // 画面に入った行を知らせる。抜粋を出さないコンパクト表示では要らない
  useEffect(() => {
    const root = listRef.current;
    if (!root || density === "compact") return;
    const byId = new Map(articles.map((a) => [a.id, a]));
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries
          .filter((e) => e.isIntersecting)
          .map((e) => byId.get((e.target as HTMLElement).dataset.articleId ?? ""))
          .filter((a): a is Article => !!a);
        if (shown.length > 0) onSummariesShown(shown);
      },
      { root },
    );
    root.querySelectorAll("[data-article-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [articles, density, onSummariesShown]);

  // キーボードで選択が動いたときに見える位置まで送る
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-article-id="${CSS.escape(selectedId)}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className={`flex w-full shrink-0 flex-col border-r border-line bg-surface md:w-[380px] lg:w-[420px] ${className}`}>
      <header className="border-b border-line px-4 pb-2.5 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="フィード一覧を開く"
            className="-my-1.5 -ml-2 rounded-lg p-2 text-muted hover:bg-line/60 hover:text-ink md:hidden"
          >
            <Icon.Menu className="h-5 w-5" />
          </button>
          <h2 className="truncate text-title font-semibold tracking-tight">{title}</h2>
          {loading && <Spinner className="h-3.5 w-3.5 text-muted" />}
          <span className="ml-auto text-2xs tabular-nums text-muted">{articles.length}件</span>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Icon.Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="記事を検索"
              title="記事を検索 (/)"
              type="search"
              enterKeyHint="search"
              className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-2 text-ui outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
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
              未読のみ
            </button>
            {sort && (
              <button
                type="button"
                onClick={onToggleSort}
                title="並べ替え: 新着順 → おすすめ → 話題順 (P)"
                className={`flex items-center gap-0.5 whitespace-nowrap rounded-md px-2 py-1 text-2xs font-medium transition-colors ${
                  sort !== "latest" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {SORT_LABEL[sort]}
                <Icon.Chevron className="h-3 w-3 rotate-90 opacity-60" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onMarkAllRead}
            title="表示中をすべて既読にする"
            aria-label="表示中をすべて既読にする"
            className="shrink-0 rounded-lg border border-line bg-surface-2 p-1.5 text-muted hover:text-ink"
          >
            <Icon.CheckAll className="h-3.5 w-3.5" />
          </button>
        </div>

        {(learning || hiddenCount > 0) && (
          <p
            className="mt-1.5 flex items-center gap-1.5 truncate text-2xs text-muted"
            title={[
              learning &&
                "記事を開く・スターで「気になる」、「興味なし」(D) で「興味なし」として覚えます。それぞれ5件たまると学習が効き始めます。",
              hiddenCount > 0 && "ミュートしたキーワードを含む記事と、興味の薄い記事を隠しています。",
            ]
              .filter(Boolean)
              .join("\n")}
          >
            {learning && (
              <span className="flex items-center gap-1">
                <Icon.Sparkle className="h-3 w-3 shrink-0" />
                好みを学習中 {Math.min(learning[0], 5)}/5 · {Math.min(learning[1], 5)}/5
              </span>
            )}
            {learning && hiddenCount > 0 && <span className="opacity-50">|</span>}
            {hiddenCount > 0 && <span>{hiddenCount}件を非表示</span>}
          </p>
        )}
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

        {articles.length === 0 && loading && <SkeletonRows density={density} />}

        {articles.length === 0 && !loading && (
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
            summary={translatedSummary(article) ?? article.summary}
            read={isRead(article.id)}
            starred={isStarred(article.id)}
            selected={article.id === selectedId}
            sources={sourcesOf(article)}
            buzz={buzzOf(article)}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
            onToggleRead={onToggleRead}
            compact={density === "compact"}
          />
        ))}
      </div>
    </section>
  );
}

/** スワイプでここまで引いたら操作する */
const SWIPE_TRIGGER_PX = 72;

function ArticleRow({
  article,
  translated,
  summary,
  read,
  starred,
  selected,
  sources,
  buzz,
  onSelect,
  onToggleStar,
  onToggleRead,
  compact,
}: {
  article: Article;
  translated: string | undefined;
  summary: string;
  read: boolean;
  starred: boolean;
  selected: boolean;
  sources: string[];
  buzz: Buzz | undefined;
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
          <span className={`flex min-w-0 items-center gap-1.5 ${read ? "opacity-60" : ""}`}>
            <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={13} />
            <span className="truncate">{article.feedTitle}</span>
            <span className="shrink-0">·</span>
            <time className="shrink-0 tabular-nums">{relativeTime(article.publishedAt)}</time>
          </span>
          <button
            type="button"
            aria-label={starred ? "スターを外す" : "スターを付ける"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(article);
            }}
            className={`-my-1 -mr-1 ml-auto shrink-0 rounded p-1 transition-colors hover:bg-line/60 pointer-coarse:-my-2.5 pointer-coarse:-mr-2.5 pointer-coarse:p-2.5 ${
              starred
                ? "text-star"
                : "text-transparent group-hover:text-muted pointer-coarse:text-muted/40"
            }`}
          >
            <Icon.Star filled={starred} className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            {/* 既読は全体を薄くして、未読との差は太さと点だけにする */}
            <div className={read ? "opacity-60" : ""}>
              <h3
                className={`mt-0.5 line-clamp-2 text-sm leading-snug text-ink ${read ? "font-normal" : "font-medium"}`}
              >
                {!read && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-accent align-middle" />}
                {translated && <TranslatedBadge size={15} className="mr-1.5 -translate-y-px" />}
                {translated ?? article.title}
              </h3>

              {!compact && summary && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{summary}</p>
              )}

              {!compact && <BuzzLine sources={sources} buzz={buzz} />}
            </div>
          </div>

          {!compact && article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt=""
              loading="lazy"
              className={`mt-1 h-16 w-16 shrink-0 rounded-lg bg-surface-2 object-cover ${read ? "opacity-60" : ""}`}
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

/** 何ソースで話題か・はてブ数・HN ポイント */
export function BuzzLine({ sources, buzz }: { sources: string[]; buzz: Buzz | undefined }) {
  const hatena = buzz?.hatena ?? 0;
  const points = buzz?.points ?? 0;
  const likes = buzz?.likes ?? 0;
  if (sources.length === 0 && hatena < 3 && points === 0 && likes === 0) return null;
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
      {hatena >= 3 && (
        <span
          className={`shrink-0 tabular-nums ${hatena >= 100 ? "font-semibold text-hot" : "text-muted"}`}
          title="はてなブックマーク数"
        >
          B! {hatena.toLocaleString()}
        </span>
      )}
      {points > 0 && (
        <span
          className={`shrink-0 tabular-nums ${points >= 200 ? "font-semibold text-hot-hn" : "text-muted"}`}
          title={`Hacker News のポイント${buzz?.comments !== undefined ? `（コメント ${buzz.comments}）` : ""}`}
        >
          ▲ {points.toLocaleString()}
        </span>
      )}
      {likes > 0 && (
        <span
          className={`shrink-0 tabular-nums ${likes >= 100 ? "font-semibold text-hot" : "text-muted"}`}
          title="Qiita / Zenn のいいね数"
        >
          ♥ {likes.toLocaleString()}
        </span>
      )}
      {sources.length > 0 && <span className="truncate text-muted">{sources.join(" · ")}</span>}
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
            {density !== "compact" && <div className="h-3 w-3/4 rounded bg-line/70" />}
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
