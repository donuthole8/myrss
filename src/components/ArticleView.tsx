"use client";

import { useEffect, useRef, useState } from "react";
import { fullDate, hostOf } from "@/lib/format";
import { startsInHorizontalScroller, useHorizontalSwipe } from "@/lib/gestures";
import type { Article, Buzz } from "@/lib/types";
import { BuzzLine } from "./ArticleList";
import { FeedIcon, Icon, TranslatedBadge } from "./ui";

/** 本文を横にこれだけ払ったら、一覧に戻る / 次の記事へ */
const SWIPE_NAV_PX = 90;

/** 右パネルの開閉を覚えておくキー */
const PANEL_KEY = "reedly:article-panel";

type Heading = { id: string; text: string; level: number };

type Props = {
  article: Article | null;
  translatedTitle?: string;
  isRead: boolean;
  isStarred: boolean;
  onToggleStar: (article: Article) => void;
  onToggleRead: (article: Article) => void;
  onDislike: (article: Article) => void;
  onClose: () => void;
  /** 次の記事へ。無ければ undefined */
  onNext?: () => void;
  sources: string[];
  buzz: Buzz | undefined;
  className?: string;
};

export function ArticleView({
  article,
  translatedTitle,
  isRead,
  isStarred,
  onToggleStar,
  onToggleRead,
  onDislike,
  onClose,
  onNext,
  sources,
  buzz,
  className = "",
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  // 原文を見出しにしている記事のID。記事を切り替えれば自然に訳へ戻る
  const [originalFor, setOriginalFor] = useState<string | null>(null);
  // Reader は ssr:false なので、初期値を localStorage から直接読んでよい
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const togglePanel = () => {
    setPanelOpen((open) => {
      try {
        localStorage.setItem(PANEL_KEY, open ? "0" : "1");
      } catch {}
      return !open;
    });
  };

  // 本文の見出しから目次を作る
  useEffect(() => {
    const body = scroller.current?.querySelector(".article-body");
    const nodes = body ? [...body.querySelectorAll<HTMLElement>("h1, h2, h3, h4")] : [];
    const found = nodes
      .map((node, i) => {
        node.id = `toc-${i}`;
        return {
          id: node.id,
          text: node.textContent?.trim() ?? "",
          level: Number(node.tagName[1]),
        };
      })
      .filter((h) => h.text);
    setHeadings(found);
    setActiveHeading(null);
  }, [article?.id, article?.content]);

  // 読んでいる位置の見出しを目次で光らせる
  useEffect(() => {
    const el = scroller.current;
    if (!el || headings.length === 0) return;
    const onScroll = () => {
      const top = el.getBoundingClientRect().top + 96;
      let current: string | null = null;
      for (const h of headings) {
        const node = document.getElementById(h.id);
        if (node && node.getBoundingClientRect().top <= top) current = h.id;
      }
      setActiveHeading(current);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [headings]);

  // スマホ向け: 右に払うと一覧へ戻る、左に払うと次の記事
  const swipe = useHorizontalSwipe({
    canStart: (e) => !startsInHorizontalScroller(e),
    onMove: (x) => {
      const el = sectionRef.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = `translateX(${x > 0 ? x : x * 0.4}px)`;
    },
    onEnd: (x) => {
      const el = sectionRef.current;
      if (el) {
        el.style.transition = "transform 180ms ease";
        el.style.transform = "";
      }
      if (x >= SWIPE_NAV_PX) onClose();
      else if (x <= -SWIPE_NAV_PX) onNext?.();
    },
  });

  // 記事を切り替えたら本文は先頭から
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [article?.id]);

  if (!article) {
    return (
      <section
        className={`hidden flex-1 items-center justify-center bg-surface md:flex ${className}`}
      >
        <div className="text-center text-muted">
          <Icon.Rss className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3 text-sm">記事を選ぶとここに表示されます</p>
          <p className="mt-1 text-xs opacity-70">J / K で移動、O で元記事を開く</p>
        </div>
      </section>
    );
  }

  const showOriginal = !!translatedTitle && originalFor === article.id;
  const setShowOriginal = (update: (v: boolean) => boolean) =>
    setOriginalFor(update(showOriginal) ? article.id : null);
  const title = showOriginal || !translatedTitle ? article.title : translatedTitle;

  const toolButton =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-line/60 hover:text-ink";

  return (
    <section ref={sectionRef} className={`flex min-w-0 flex-1 flex-col bg-surface ${className}`}>
      <header className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => onToggleStar(article)}
          className={`${toolButton} ${isStarred ? "text-star hover:text-star" : ""}`}
        >
          <Icon.Star filled={isStarred} className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">{isStarred ? "スター付き" : "スター"}</span>
        </button>
        <button type="button" onClick={() => onToggleRead(article)} className={toolButton}>
          <Icon.Check className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">{isRead ? "未読に戻す" : "既読にする"}</span>
        </button>
        <button
          type="button"
          onClick={() => onDislike(article)}
          title="似た記事をおすすめしにくくして次へ (D)"
          className={toolButton}
        >
          <Icon.ThumbDown className="h-3.5 w-3.5" />
          <span className="max-sm:sr-only">興味なし</span>
        </button>
        {article.link && (
          <a href={article.link} target="_blank" rel="noopener noreferrer" className={toolButton}>
            <Icon.External className="h-3.5 w-3.5" />
            <span className="max-sm:sr-only">元記事</span>
          </a>
        )}
        <button
          type="button"
          onClick={togglePanel}
          aria-label={panelOpen ? "情報パネルを閉じる" : "情報パネルを開く"}
          title={panelOpen ? "情報パネルを閉じる" : "情報パネルを開く"}
          className={`ml-auto hidden rounded-lg p-1.5 transition-colors hover:bg-line/60 hover:text-ink xl:block ${
            panelOpen ? "text-ink" : "text-muted"
          }`}
        >
          <Icon.PanelRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="ml-auto rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-ink md:hidden"
        >
          <Icon.X />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scroller}
          className="scroll-thin min-w-0 flex-1 overflow-y-auto"
          {...swipe.handlers}
        >
          <div className="mx-auto max-w-[42rem] px-5 py-10 sm:px-8">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={16} />
              <span className="truncate font-medium text-ink/70">{article.feedTitle}</span>
              {article.link && (
                <>
                  <span>·</span>
                  <span className="truncate">{hostOf(article.link)}</span>
                </>
              )}
            </div>

            <h1 className="mt-4 font-serif text-[2rem] font-bold leading-[1.3] tracking-tight">
              {article.link ? (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </h1>
            {translatedTitle && (
              <div className="mt-2.5">
                <p className="text-[14px] leading-snug text-muted" lang={showOriginal ? "ja" : "en"}>
                  {showOriginal ? translatedTitle : article.title}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                  <TranslatedBadge size={16} />
                  <span>DeepL で翻訳</span>
                  <span className="opacity-50">·</span>
                  <button
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="rounded-full border border-line px-2 py-px transition-colors hover:border-accent hover:text-accent"
                  >
                    {showOriginal ? "訳を見出しにする" : "原文を見出しにする"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
              {article.author && <span>{article.author}</span>}
              {article.author && article.publishedAt && <span>·</span>}
              {article.publishedAt && <time>{fullDate(article.publishedAt)}</time>}
            </div>
            <BuzzLine sources={sources} buzz={buzz} />

            <hr className="my-8 border-line" />

            {article.content ? (
              <div
                className="article-body"
                // フィード本文は /lib/rss.ts の sanitize-html を通してから保存している
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <p className="text-sm text-muted">
                本文が配信されていません。
                {article.link && (
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-accent underline underline-offset-2"
                  >
                    元記事を開く
                  </a>
                )}
              </p>
            )}

            {article.link && (
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-12 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink"
              >
                元記事を開く
                <Icon.External className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {panelOpen && (
          <InfoPanel
            article={article}
            headings={headings}
            activeHeading={activeHeading}
            sources={sources}
            buzz={buzz}
            onJump={(id) => {
              const el = scroller.current;
              const node = document.getElementById(id);
              if (!el || !node) return;
              const offset = node.getBoundingClientRect().top - el.getBoundingClientRect().top;
              el.scrollTo({
                top: el.scrollTop + offset - 24,
                behavior: "smooth",
              });
            }}
          />
        )}
      </div>
    </section>
  );
}

/** 広い画面で右に出す、目次と記事の情報 */
function InfoPanel({
  article,
  headings,
  activeHeading,
  sources,
  buzz,
  onJump,
}: {
  article: Article;
  headings: Heading[];
  activeHeading: string | null;
  sources: string[];
  buzz: Buzz | undefined;
  onJump: (id: string) => void;
}) {
  const minLevel = Math.min(...headings.map((h) => h.level));
  const sectionTitle = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted";
  const rows: [string, React.ReactNode][] = [
    [
      "フィード",
      <span key="feed" className="flex min-w-0 items-center gap-1.5">
        <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={14} />
        <span className="truncate">{article.feedTitle}</span>
      </span>,
    ],
  ];
  if (article.link) {
    rows.push([
      "ドメイン",
      <a
        key="host"
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate hover:text-accent"
      >
        {hostOf(article.link)}
      </a>,
    ]);
  }
  if (article.author) rows.push(["著者", article.author]);
  if (article.publishedAt) rows.push(["公開", fullDate(article.publishedAt)]);
  if (buzz?.hatena) rows.push(["はてブ", `${buzz.hatena.toLocaleString()} users`]);
  if (buzz?.points) {
    rows.push([
      "Hacker News",
      `${buzz.points.toLocaleString()} pt${buzz.comments !== undefined ? ` · ${buzz.comments} コメント` : ""}`,
    ]);
  }

  return (
    <aside className="scroll-thin hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-bg px-5 py-6 xl:block">
      {headings.length > 0 && (
        <nav className="mb-8">
          <h2 className={sectionTitle}>目次</h2>
          <ul className="space-y-0.5">
            {headings.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onJump(h.id)}
                  style={{ paddingLeft: `${(h.level - minLevel) * 12 + 10}px` }}
                  className={`block w-full border-l-2 py-1 pr-1 text-left text-[12.5px] leading-snug transition-colors ${
                    activeHeading === h.id
                      ? "border-accent font-medium text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <span className="line-clamp-2">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section>
        <h2 className={sectionTitle}>情報</h2>
        <dl className="space-y-2.5 text-[12.5px]">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="text-muted">{label}</dt>
              <dd className="flex min-w-0 text-ink/85">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sources.length > 0 && (
        <section className="mt-8">
          <h2 className={sectionTitle}>同じ話題のフィード</h2>
          <ul className="space-y-1.5 text-[12.5px] text-ink/85">
            {sources.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
