"use client";

import { useEffect, useRef, useState } from "react";
import { fullDate, hostOf, relativeTime } from "@/lib/format";
import { startsInHorizontalScroller, useHorizontalSwipe } from "@/lib/gestures";
import type { ReadingFont, ReadingSize } from "@/lib/store";
import type { Article, Buzz } from "@/lib/types";
import { BuzzLine } from "./ArticleList";
import { FeedIcon, Icon, Segmented, TranslatedBadge } from "./ui";

/** 本文を横にこれだけ払ったら、一覧に戻る / 次の記事へ */
const SWIPE_NAV_PX = 90;

/** 右パネルの開閉を覚えておくキー */
const PANEL_KEY = "reedly:article-panel";

type Heading = { id: string; text: string; level: number };

/** かな・漢字を含まなければ英文として組む */
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

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
  /** タイトルと要約の語が近い記事 (同じ話題として束ねたものは除く) */
  related: Article[];
  titleJa: (article: Article) => string | undefined;
  isArticleRead: (id: string) => boolean;
  onOpenRelated: (article: Article) => void;
  readingSize: ReadingSize;
  readingFont: ReadingFont;
  onChangeReadingSize: (size: ReadingSize) => void;
  onChangeReadingFont: (font: ReadingFont) => void;
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
  related,
  titleJa,
  isArticleRead,
  onOpenRelated,
  readingSize,
  readingFont,
  onChangeReadingSize,
  onChangeReadingFont,
  className = "",
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  // 原文を見出しにしている記事のID。記事を切り替えれば自然に訳へ戻る
  const [originalFor, setOriginalFor] = useState<string | null>(null);
  // Reader は ssr:false なので、初期値を localStorage から直接読んでよい
  const [panelOpen, setPanelOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) === "1";
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

  // どこまで読んだかをヘッダー下の細いバーで出す。スクロールごとに描き直さないよう style を直接書く
  useEffect(() => {
    const el = scroller.current;
    const bar = progressRef.current;
    if (!el || !bar) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(el.scrollTop / max, 1) : 0})`;
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [article?.id]);

  // 文字の設定メニューは外側を押すか Esc で閉じる
  useEffect(() => {
    if (!typeMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!typeMenuRef.current?.contains(e.target as Node)) setTypeMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTypeMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [typeMenuOpen]);

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
    "rounded-lg p-2 text-muted transition-colors hover:bg-line/60 hover:text-ink";

  return (
    <section ref={sectionRef} className={`flex min-w-0 flex-1 flex-col bg-surface ${className}`}>
      <header className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => onToggleStar(article)}
          aria-label={isStarred ? "スターを外す" : "スターを付ける"}
          aria-pressed={isStarred}
          title={isStarred ? "スターを外す (S)" : "スターを付ける (S)"}
          className={`${toolButton} ${isStarred ? "text-star hover:text-star" : ""}`}
        >
          <Icon.Star filled={isStarred} className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleRead(article)}
          aria-label={isRead ? "未読に戻す" : "既読にする"}
          title={isRead ? "未読に戻す (M)" : "既読にする (M)"}
          className={toolButton}
        >
          <Icon.Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDislike(article)}
          aria-label="興味なし"
          title="興味なし: 似た記事をおすすめしにくくして次へ (D)"
          className={toolButton}
        >
          <Icon.ThumbDown className="h-4 w-4" />
        </button>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="元記事を開く"
            title="元記事を開く (O)"
            className={toolButton}
          >
            <Icon.External className="h-4 w-4" />
          </a>
        )}
        <div ref={typeMenuRef} className="relative ml-auto">
          <button
            type="button"
            onClick={() => setTypeMenuOpen((v) => !v)}
            aria-label="文字の大きさと書体"
            title="文字の大きさと書体"
            aria-expanded={typeMenuOpen}
            className={`rounded-lg px-2 py-1 text-ui font-semibold transition-colors hover:bg-line/60 hover:text-ink ${
              typeMenuOpen ? "bg-line/60 text-ink" : "text-muted"
            }`}
          >
            Aa
          </button>
          {typeMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-56 space-y-3 rounded-xl border border-line bg-surface p-3 shadow-xl">
              <div>
                <p className="mb-1.5 text-2xs font-semibold text-muted">文字の大きさ</p>
                <Segmented
                  label="文字の大きさ"
                  value={readingSize}
                  onChange={onChangeReadingSize}
                  options={[
                    { value: "s", label: "小" },
                    { value: "m", label: "中" },
                    { value: "l", label: "大" },
                  ]}
                />
              </div>
              <div>
                <p className="mb-1.5 text-2xs font-semibold text-muted">書体</p>
                <Segmented
                  label="書体"
                  value={readingFont}
                  onChange={onChangeReadingFont}
                  options={[
                    { value: "serif", label: "明朝" },
                    { value: "sans", label: "ゴシック" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={togglePanel}
          aria-label={panelOpen ? "情報パネルを閉じる" : "情報パネルを開く"}
          title={panelOpen ? "情報パネルを閉じる" : "情報パネルを開く"}
          className={`hidden rounded-lg p-1.5 transition-colors hover:bg-line/60 hover:text-ink xl:block ${
            panelOpen ? "text-ink" : "text-muted"
          }`}
        >
          <Icon.PanelRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-ink md:hidden"
        >
          <Icon.X />
        </button>
      </header>
      <div className="relative h-0" aria-hidden="true">
        <div
          ref={progressRef}
          style={{ transform: "scaleX(0)" }}
          className="absolute inset-x-0 top-0 z-10 h-0.5 origin-left bg-accent/70"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scroller}
          className="scroll-thin min-w-0 flex-1 overflow-y-auto"
          {...swipe.handlers}
        >
          <div className="mx-auto max-w-[42rem] px-5 py-10 sm:px-8">
            <div className="flex items-center gap-2 text-xs text-muted">
              <FeedIcon siteUrl={article.link || ""} title={article.feedTitle} size={16} />
              <span className="truncate font-medium text-ink/70">{article.feedTitle}</span>
              {article.link && (
                <>
                  <span>·</span>
                  <span className="truncate">{hostOf(article.link)}</span>
                </>
              )}
            </div>

            <h1
              className={`mt-4 text-[1.6rem] font-bold leading-[1.3] tracking-tight sm:text-[2rem] ${
                readingFont === "sans" ? "font-sans" : "font-serif"
              }`}
            >
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
            {/* 著者・日時・翻訳の切り替えは1行にまとめる */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {[
                article.author && <span key="author">{article.author}</span>,
                article.publishedAt && <time key="date">{fullDate(article.publishedAt)}</time>,
                translatedTitle && (
                  <button
                    key="original"
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    title={showOriginal ? translatedTitle : article.title}
                    className="inline-flex items-center gap-1 transition-colors hover:text-accent"
                  >
                    <TranslatedBadge size={14} />
                    {showOriginal ? "訳を見る" : "原文を見る"}
                  </button>
                ),
              ]
                .filter(Boolean)
                .flatMap((node, i) => (i === 0 ? [node] : [<span key={`sep-${i}`} className="opacity-50">·</span>, node]))}
            </div>
            <BuzzLine sources={sources} buzz={buzz} />

            <hr className="my-8 border-line" />

            {article.content ? (
              <div
                className="article-body"
                lang={JAPANESE.test(article.title + (article.summary ?? "")) ? "ja" : "en"}
                data-size={readingSize}
                data-font={readingFont}
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
                className="mt-12 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-ui font-medium text-accent-ink"
              >
                元記事を開く
                <Icon.External className="h-3.5 w-3.5" />
              </a>
            )}

            {related.length > 0 && (
              <RelatedList
                articles={related}
                titleJa={titleJa}
                isRead={isArticleRead}
                onOpen={onOpenRelated}
              />
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

/** 本文の下に出す関連記事。スマホでも見えるよう右パネルではなくここに置く */
function RelatedList({
  articles,
  titleJa,
  isRead,
  onOpen,
}: {
  articles: Article[];
  titleJa: (article: Article) => string | undefined;
  isRead: (id: string) => boolean;
  onOpen: (article: Article) => void;
}) {
  return (
    <section className="mt-14 border-t border-line pt-6">
      <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted">関連記事</h2>
      <ul className="space-y-1">
        {articles.map((a) => {
          const ja = titleJa(a);
          const read = isRead(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-line/40"
              >
                <FeedIcon siteUrl={a.link || ""} title={a.feedTitle} size={16} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span
                    className={`flex items-start gap-1.5 text-ui leading-snug ${
                      read ? "text-muted" : "font-medium text-ink"
                    }`}
                  >
                    {ja && <TranslatedBadge size={15} className="mt-px" />}
                    <span className="line-clamp-2">{ja ?? a.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-2xs text-muted">
                    {a.feedTitle}
                    {a.publishedAt && ` · ${relativeTime(a.publishedAt)}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
  const sectionTitle = "mb-2 text-2xs font-semibold uppercase tracking-wider text-muted";
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
  if (buzz?.likes) rows.push(["いいね", buzz.likes.toLocaleString()]);
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
                  className={`block w-full border-l-2 py-1 pr-1 text-left text-xs leading-snug transition-colors ${
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
        <dl className="space-y-2.5 text-xs">
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
          <ul className="space-y-1.5 text-xs text-ink/85">
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
