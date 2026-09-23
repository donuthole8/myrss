"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { PULL_TRIGGER_PX, useHorizontalSwipe, usePullToRefresh } from "@/lib/gestures";
import type { SortMode } from "@/lib/store";
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
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
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
      <header className="border-b border-line px-4 pb-2.5 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="フィード一覧を開く"
            className="-ml-1 rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink md:hidden"
          >
            <Icon.Rss />
          </button>
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
          {loading && <Spinner className="h-3.5 w-3.5 text-muted" />}
          <span className="ml-auto text-[11px] tabular-nums text-muted">{articles.length}件</span>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Icon.Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="記事を検索  /"
              className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-2 text-[13px] outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={onToggleUnreadOnly}
            title="未読のみ表示 (U)"
            className={`whitespace-nowrap rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              unreadOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            未読のみ
          </button>
          {sort && (
            <button
              type="button"
              onClick={onToggleSort}
              title="並べ替え: 新着順 → おすすめ → 話題順 (P)"
              className={`whitespace-nowrap rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                sort !== "latest"
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface-2 text-muted hover:text-ink"
              }`}
            >
              {SORT_LABEL[sort]}
            </button>
          )}
          <button
            type="button"
            onClick={onMarkAllRead}
            title="表示中をすべて既読にする"
            aria-label="表示中をすべて既読にする"
            className="rounded-lg border border-line bg-surface-2 p-1.5 text-muted hover:text-ink"
          >
            <Icon.CheckAll className="h-3.5 w-3.5" />
          </button>
        </div>

        {sort === "recommended" && training && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            好みを学習中です（気になる記事 {Math.min(training[0], 5)}/5 · 興味なし {Math.min(training[1], 5)}/5）。
            記事を開く・スター・「興味なし」(D) で覚えます。
          </p>
        )}
        {hiddenCount > 0 && (
          <p className="mt-1 text-[11px] text-muted">ミュート・興味の薄い記事を {hiddenCount}件 隠しています</p>
        )}

        {keywords && keywords.length > 0 && (
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
            <span className="shrink-0 self-center text-[11px] font-semibold text-muted">急上昇</span>
            {keywords.map((k) => {
              const active = query.trim().toLowerCase() === k.term;
              return (
                <button
                  key={k.term}
                  type="button"
                  onClick={() => onPickKeyword(active ? "" : k.term)}
                  title={`直近2日で ${k.recent} 件（ふだんは ${k.baseline.toFixed(1)} 件ほど）`}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors ${
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
      </header>

      <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto overscroll-y-contain" {...pull}>
        <div
          ref={pullRef}
          data-ready="0"
          className="group/pull flex h-0 items-end justify-center overflow-hidden text-[11.5px] text-muted"
          aria-hidden="true"
        >
          <span className="flex items-center gap-1.5 pb-2">
            <Icon.Refresh className="h-3.5 w-3.5 transition-transform group-data-[ready=1]/pull:rotate-180" />
            <span className="group-data-[ready=1]/pull:hidden">引っ張って更新</span>
            <span className="hidden group-data-[ready=1]/pull:inline">離すと更新</span>
          </span>
        </div>

        {articles.length === 0 && !loading && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {query ? "一致する記事がありません" : unreadOnly ? "未読の記事はありません" : "記事がありません"}
          </p>
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
            onSelect={onSelect}
            onToggleStar={onToggleStar}
            onToggleRead={onToggleRead}
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
  read,
  starred,
  selected,
  sources,
  buzz,
  onSelect,
  onToggleStar,
  onToggleRead,
}: {
  article: Article;
  translated: string | undefined;
  read: boolean;
  starred: boolean;
  selected: boolean;
  sources: string[];
  buzz: Buzz | undefined;
  onSelect: (article: Article) => void;
  onToggleStar: (article: Article) => void;
  onToggleRead: (article: Article) => void;
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
          className={`absolute inset-0 flex items-center px-5 text-[12px] font-semibold transition-colors ${
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
        className={`group relative cursor-pointer touch-pan-y rounded-xl px-3 py-3 transition-colors ${
          selected ? "bg-accent-soft" : "bg-surface hover:bg-surface-2"
        }`}
      >
        <div className="flex gap-3">
          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt=""
              loading="lazy"
              className="h-[72px] w-[72px] shrink-0 rounded-lg bg-surface-2 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={13} />
              <span className="truncate">{article.feedTitle}</span>
              <span className="shrink-0">·</span>
              <time className="shrink-0 tabular-nums">{relativeTime(article.publishedAt)}</time>
            </div>

            <h3
              className={`mt-1 line-clamp-2 text-[14px] leading-snug ${
                read ? "font-normal text-muted" : "font-semibold text-ink"
              }`}
            >
              {!read && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-accent align-middle" />}
              {translated && <TranslatedBadge className="mr-1.5 -translate-y-px" />}
              {translated ?? article.title}
            </h3>
            {translated && (
              <p className="mt-0.5 truncate text-[11px] text-muted">
                <span className="mr-1 opacity-70">原文</span>
                <span lang="en">{article.title}</span>
              </p>
            )}

            {article.summary && (
              <p className="mt-1 line-clamp-2 pr-6 text-[12.5px] leading-relaxed text-muted">
                {article.summary}
              </p>
            )}

            <BuzzLine sources={sources} buzz={buzz} />
          </div>
        </div>

        <button
          type="button"
          aria-label={starred ? "スターを外す" : "スターを付ける"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(article);
          }}
          className={`absolute bottom-2.5 right-3 rounded p-1 transition-colors hover:bg-line/60 ${
            starred ? "text-star" : "text-transparent group-hover:text-muted"
          }`}
        >
          <Icon.Star filled={starred} className="h-3.5 w-3.5" />
        </button>
      </article>
    </div>
  );
}

/** 何ソースで話題か・はてブ数・HN ポイント */
export function BuzzLine({ sources, buzz }: { sources: string[]; buzz: Buzz | undefined }) {
  const hatena = buzz?.hatena ?? 0;
  const points = buzz?.points ?? 0;
  if (sources.length === 0 && hatena < 3 && points === 0) return null;
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 pr-6 text-[11px]">
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
          className={`shrink-0 tabular-nums ${hatena >= 100 ? "font-semibold text-red-500" : "text-muted"}`}
          title="はてなブックマーク数"
        >
          B! {hatena.toLocaleString()}
        </span>
      )}
      {points > 0 && (
        <span
          className={`shrink-0 tabular-nums ${points >= 200 ? "font-semibold text-orange-500" : "text-muted"}`}
          title={`Hacker News のポイント${buzz?.comments !== undefined ? `（コメント ${buzz.comments}）` : ""}`}
        >
          ▲ {points.toLocaleString()}
        </span>
      )}
      {sources.length > 0 && <span className="truncate text-muted">{sources.join(" · ")}</span>}
    </div>
  );
}
