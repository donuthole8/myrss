"use client";

import { useEffect, useRef } from "react";
import { fullDate, hostOf } from "@/lib/format";
import type { Article } from "@/lib/types";
import { FeedIcon, Icon } from "./ui";

type Props = {
  article: Article | null;
  isRead: boolean;
  isStarred: boolean;
  onToggleStar: (article: Article) => void;
  onToggleRead: (article: Article) => void;
  onClose: () => void;
  className?: string;
};

export function ArticleView({
  article,
  isRead,
  isStarred,
  onToggleStar,
  onToggleRead,
  onClose,
  className = "",
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  // 記事を切り替えたら本文は先頭から
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [article?.id]);

  if (!article) {
    return (
      <section className={`hidden flex-1 items-center justify-center bg-bg md:flex ${className}`}>
        <div className="text-center text-muted">
          <Icon.Rss className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3 text-sm">記事を選ぶとここに表示されます</p>
          <p className="mt-1 text-xs opacity-70">J / K で移動、O で元記事を開く</p>
        </div>
      </section>
    );
  }

  const toolButton =
    "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink";

  return (
    <section className={`flex min-w-0 flex-1 flex-col bg-bg ${className}`}>
      <header className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2">
        <button
          type="button"
          onClick={() => onToggleStar(article)}
          className={`${toolButton} ${isStarred ? "border-star/50 text-star" : ""}`}
        >
          <Icon.Star filled={isStarred} className="h-3.5 w-3.5" />
          {isStarred ? "スター付き" : "スター"}
        </button>
        <button type="button" onClick={() => onToggleRead(article)} className={toolButton}>
          <Icon.Check className="h-3.5 w-3.5" />
          {isRead ? "未読に戻す" : "既読にする"}
        </button>
        {article.link && (
          <a href={article.link} target="_blank" rel="noopener noreferrer" className={toolButton}>
            <Icon.External className="h-3.5 w-3.5" />
            元記事
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="ml-auto rounded-lg p-1.5 text-muted hover:bg-line/60 hover:text-ink md:hidden"
        >
          <Icon.X />
        </button>
      </header>

      <div ref={scroller} className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[44rem] px-5 py-8 sm:px-8">
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

          <h1 className="mt-3 text-[1.75rem] font-bold leading-[1.3] tracking-tight">
            {article.link ? (
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                {article.title}
              </a>
            ) : (
              article.title
            )}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            {article.author && <span>{article.author}</span>}
            {article.author && article.publishedAt && <span>·</span>}
            {article.publishedAt && <time>{fullDate(article.publishedAt)}</time>}
          </div>

          <hr className="my-6 border-line" />

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
              className="mt-10 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink"
            >
              元記事を開く
              <Icon.External className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
