"use client";

import { useEffect, useRef } from "react";
import { relativeTime } from "@/lib/format";
import type { Article } from "@/lib/types";
import { FeedIcon, Icon, Spinner } from "./ui";

type Props = {
  title: string;
  articles: Article[];
  selectedId: string | null;
  onSelect: (article: Article) => void;
  isRead: (id: string) => boolean;
  isStarred: (id: string) => boolean;
  onToggleStar: (article: Article) => void;
  query: string;
  onQueryChange: (value: string) => void;
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  onMarkAllRead: () => void;
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
  isRead,
  isStarred,
  onToggleStar,
  query,
  onQueryChange,
  unreadOnly,
  onToggleUnreadOnly,
  onMarkAllRead,
  loading,
  searchRef,
  className = "",
  onOpenNav,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

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
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              unreadOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            未読のみ
          </button>
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
      </header>

      <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto">
        {articles.length === 0 && !loading && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {query ? "一致する記事がありません" : unreadOnly ? "未読の記事はありません" : "記事がありません"}
          </p>
        )}

        {articles.map((article) => {
          const read = isRead(article.id);
          const starred = isStarred(article.id);
          const selected = article.id === selectedId;
          return (
            <article
              key={article.id}
              data-article-id={article.id}
              onClick={() => onSelect(article)}
              className={`group relative cursor-pointer border-b border-line/70 px-4 py-3 transition-colors ${
                selected ? "bg-accent-soft" : "hover:bg-surface-2"
              }`}
            >
              {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
              <div className="flex gap-3">
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
                    {article.title}
                  </h3>

                  {article.summary && (
                    <p className="mt-1 line-clamp-2 pr-6 text-[12.5px] leading-relaxed text-muted">
                      {article.summary}
                    </p>
                  )}
                </div>

                {article.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.image}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-md border border-line object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
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
          );
        })}
      </div>
    </section>
  );
}
