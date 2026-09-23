"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { CATALOG, type CatalogCategory, type CatalogFeed } from "@/lib/presets";
import type { Article, FeedResult } from "@/lib/types";
import { FeedIcon, Icon, Spinner } from "./ui";

type Props = {
  subscribedUrls: Set<string>;
  onSubscribe: (feeds: CatalogFeed[], folder: string) => void;
  onUnsubscribe: (url: string) => void;
  onClose: () => void;
};

type Preview = { state: "loading" } | { state: "error" } | { state: "ok"; articles: Article[] };

function matches(feed: CatalogFeed, category: CatalogCategory, q: string): boolean {
  if (!q) return true;
  return [feed.title, feed.description, feed.url, category.title]
    .join("\n")
    .toLowerCase()
    .includes(q);
}

/** おすすめフィードを眺めて、その場で追加・解除する */
export function FeedCatalog({ subscribedUrls, onSubscribe, onUnsubscribe, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      CATALOG.map((category) => ({
        category,
        feeds: category.feeds.filter((f) => matches(f, category, q)),
      })).filter((s) => s.feeds.length > 0),
    [q],
  );

  const jump = (id: string) => {
    scroller.current
      ?.querySelector(`[data-category="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const togglePreview = (feed: CatalogFeed) => {
    if (openPreview === feed.url) {
      setOpenPreview(null);
      return;
    }
    setOpenPreview(feed.url);
    if (previews[feed.url]?.state === "ok" || previews[feed.url]?.state === "loading") return;
    setPreviews((prev) => ({ ...prev, [feed.url]: { state: "loading" } }));
    void fetch(`/api/feed?url=${encodeURIComponent(feed.url)}`)
      .then((res) => res.json() as Promise<FeedResult>)
      .then((data) =>
        setPreviews((prev) => ({
          ...prev,
          [feed.url]: data.ok ? { state: "ok", articles: data.feed.articles.slice(0, 4) } : { state: "error" },
        })),
      )
      .catch(() => setPreviews((prev) => ({ ...prev, [feed.url]: { state: "error" } })));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:p-4 sm:pt-[6vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="おすすめフィード"
        className="flex h-dvh w-full max-w-4xl flex-col overflow-hidden border-line bg-surface shadow-2xl sm:h-[86dvh] sm:rounded-xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Sparkle className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">おすすめフィード</h2>
          <div className="relative ml-auto w-44 sm:w-64">
            <Icon.Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・内容で絞り込む"
              className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-2 text-[13px] outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink"
          >
            <Icon.X />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* カテゴリ: 狭い画面では横スクロールのチップ、広い画面では左の目次 */}
          <nav className="scroll-thin flex shrink-0 gap-1.5 overflow-x-auto border-b border-line px-3 py-2 md:w-48 md:flex-col md:gap-0.5 md:overflow-y-auto md:border-b-0 md:border-r md:py-3">
            {sections.map(({ category, feeds }) => {
              const added = feeds.filter((f) => subscribedUrls.has(f.url)).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => jump(category.id)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-left text-[12px] text-ink/85 hover:bg-line/50 md:rounded-lg md:border-0 md:py-1.5 md:text-[13px]"
                >
                  <span className="truncate">{category.title}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted">
                    {added > 0 ? `${added}/${feeds.length}` : feeds.length}
                  </span>
                </button>
              );
            })}
          </nav>

          <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {sections.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">一致するフィードがありません</p>
            )}

            {sections.map(({ category, feeds }) => {
              const rest = feeds.filter((f) => !subscribedUrls.has(f.url));
              return (
                <section key={category.id} data-category={category.id} className="scroll-mt-2 pt-4">
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold">{category.title}</h3>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {category.description}
                        <span className="ml-1 opacity-70">・「{category.folder}」フォルダに追加</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={rest.length === 0}
                      onClick={() => onSubscribe(rest, category.folder)}
                      className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-ink disabled:bg-line disabled:text-muted"
                    >
                      {rest.length === 0 ? "すべて購読中" : `まとめて追加 (${rest.length})`}
                    </button>
                  </div>

                  <ul className="mt-2.5 grid items-start gap-2 lg:grid-cols-2">
                    {feeds.map((feed) => {
                      const subscribed = subscribedUrls.has(feed.url);
                      const preview = openPreview === feed.url ? previews[feed.url] : undefined;
                      return (
                        <li
                          key={feed.url}
                          className={`rounded-lg border px-3 py-2.5 transition-colors ${
                            subscribed ? "border-accent/40 bg-accent-soft/40" : "border-line bg-surface-2"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <FeedIcon siteUrl={feed.siteUrl} title={feed.title} size={20} className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5">
                                <span className="truncate text-[13.5px] font-medium">{feed.title}</span>
                                {feed.lang === "en" && (
                                  <span
                                    title="英語のフィード。タイトルは日本語訳して表示します"
                                    className="shrink-0 rounded border border-line px-1 text-[10px] leading-4 text-muted"
                                  >
                                    英語
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                                {feed.description}
                              </p>
                              <button
                                type="button"
                                onClick={() => togglePreview(feed)}
                                className="mt-1 inline-flex items-center gap-0.5 text-[11.5px] text-accent hover:underline"
                              >
                                <Icon.Chevron
                                  className={`h-3 w-3 transition-transform ${openPreview === feed.url ? "rotate-90" : ""}`}
                                />
                                最新の記事を見る
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                subscribed ? onUnsubscribe(feed.url) : onSubscribe([feed], category.folder)
                              }
                              title={subscribed ? "購読を解除" : `「${category.folder}」フォルダに追加`}
                              className={`group/btn inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                                subscribed
                                  ? "border border-accent/40 text-accent hover:border-red-500/50 hover:text-red-500"
                                  : "border border-line bg-surface text-ink hover:border-accent hover:text-accent"
                              }`}
                            >
                              {subscribed ? (
                                <>
                                  <Icon.Check className="h-3.5 w-3.5 group-hover/btn:hidden" />
                                  <Icon.X className="hidden h-3.5 w-3.5 group-hover/btn:block" />
                                  <span className="group-hover/btn:hidden">購読中</span>
                                  <span className="hidden group-hover/btn:inline">解除</span>
                                </>
                              ) : (
                                <>
                                  <Icon.Plus className="h-3.5 w-3.5" />
                                  追加
                                </>
                              )}
                            </button>
                          </div>

                          {preview && (
                            <div className="mt-2 border-t border-line/70 pt-2">
                              {preview.state === "loading" && (
                                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                                  <Spinner className="h-3 w-3" /> 読み込み中…
                                </p>
                              )}
                              {preview.state === "error" && (
                                <p className="text-[12px] text-red-500">記事を取得できませんでした</p>
                              )}
                              {preview.state === "ok" && (
                                <ul className="space-y-1">
                                  {preview.articles.map((a) => (
                                    <li key={a.id} className="flex gap-2 text-[12px] leading-snug">
                                      <a
                                        href={a.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="line-clamp-1 min-w-0 flex-1 hover:text-accent hover:underline"
                                      >
                                        {a.title}
                                      </a>
                                      <time className="shrink-0 tabular-nums text-muted">
                                        {relativeTime(a.publishedAt)}
                                      </time>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
