"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLongPress } from "@/lib/gestures";
import { UNCATEGORIZED, folderOf, type Theme } from "@/lib/store";
import { type Feed, type View, viewKey } from "@/lib/types";
import { FeedIcon, Icon, Spinner } from "./ui";

type Props = {
  feeds: Feed[];
  view: View;
  onSelectView: (view: View) => void;
  unreadByFeed: Record<string, number>;
  totalUnread: number;
  aiUnread: number;
  /** 話題ランキングに載っている未読の数 */
  trendingUnread: number;
  /** 今日の N 本の本数と、そのうち未読の数 */
  dailyCount: number;
  todayUnread: number;
  /** マイスタックに関わる未読の数。未登録なら null */
  stackUnread: number | null;
  onOpenStack: () => void;
  watches: Array<{ keyword: string; unread: number }>;
  onAddWatch: (keyword: string, withNews: boolean) => void;
  onRemoveWatch: (keyword: string) => void;
  starredCount: number;
  errors: Record<string, string>;
  refreshing: boolean;
  lastUpdated: number | null;
  theme: Theme;
  isDark: boolean;
  onCycleTheme: () => void;
  onRefresh: () => void;
  onAddFeed: () => void;
  onBrowseCatalog: () => void;
  onEditFeed: (url: string) => void;
  /** 空文字なら未分類 */
  onEditFolder: (name: string) => void;
  onExportOpml: () => void;
  onImportOpml: (file: File) => void;
  onShowShortcuts: () => void;
  onOpenPrefs: () => void;
};

const THEME_LABEL: Record<Theme, string> = {
  system: "OSに合わせる",
  light: "ライト",
  dark: "ダーク",
};

function Count({ value, active }: { value: number; active: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {value > 999 ? "999+" : value}
    </span>
  );
}

export function Sidebar({
  feeds,
  view,
  onSelectView,
  unreadByFeed,
  totalUnread,
  aiUnread,
  trendingUnread,
  dailyCount,
  todayUnread,
  stackUnread,
  onOpenStack,
  watches,
  onAddWatch,
  onRemoveWatch,
  starredCount,
  errors,
  refreshing,
  lastUpdated,
  theme,
  isDark,
  onCycleTheme,
  onRefresh,
  onAddFeed,
  onBrowseCatalog,
  onEditFeed,
  onEditFolder,
  onExportOpml,
  onImportOpml,
  onShowShortcuts,
  onOpenPrefs,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const current = viewKey(view);
  const [watchDraft, setWatchDraft] = useState<string | null>(null);
  const [watchNews, setWatchNews] = useState(true);

  // スマホは長押し、PC は右クリックで編集を開く
  const press = useLongPress((target) => {
    const { feed, folder, watch, stack } = target.dataset;
    if (stack !== undefined) onOpenStack();
    else if (feed !== undefined) onEditFeed(feed);
    else if (folder !== undefined) onEditFolder(folder);
    else if (watch !== undefined && window.confirm(`ウォッチ「${watch}」をやめますか？`)) {
      onRemoveWatch(watch);
    }
  });

  const submitWatch = () => {
    const keyword = watchDraft?.trim();
    if (keyword) onAddWatch(keyword, watchNews);
    setWatchDraft(null);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Feed[]>();
    for (const feed of feeds) {
      const key = folderOf(feed);
      map.set(key, [...(map.get(key) ?? []), feed]);
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        feeds: [...items].sort((a, b) => a.title.localeCompare(b.title, "ja")),
        unread: items.reduce((sum, f) => sum + (unreadByFeed[f.url] ?? 0), 0),
      }))
      .sort((a, b) =>
        a.name === UNCATEGORIZED ? 1 : b.name === UNCATEGORIZED ? -1 : a.name.localeCompare(b.name, "ja"),
      );
  }, [feeds, unreadByFeed]);

  const rowClass = (key: string) =>
    `group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors pointer-coarse:py-2.5 ${
      current === key
        ? "bg-accent-soft text-accent font-medium"
        : "text-ink/80 hover:bg-line/50"
    }`;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-bg">
      <div className="flex items-center gap-2 px-3 py-3">
        {/* アプリアイコンと同じ絵を使う */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
        <span className="text-title font-semibold tracking-tight">Coffeed</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="すべて更新 (R)"
            aria-label="すべて更新"
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink disabled:opacity-50 pointer-coarse:p-2.5"
          >
            {refreshing ? <Spinner /> : <Icon.Refresh />}
          </button>
          {/* 追加は URL から / おすすめから の2通りを1つのボタンにまとめる */}
          <PopMenu
            label="フィードを追加"
            align="right"
            trigger={<Icon.Plus />}
            triggerClass="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink pointer-coarse:p-2.5"
            items={[
              { icon: <Icon.Rss className="h-3.5 w-3.5" />, label: "URL で追加", hint: "A", onSelect: onAddFeed },
              { icon: <Icon.Sparkle className="h-3.5 w-3.5" />, label: "おすすめから探す", onSelect: onBrowseCatalog },
            ]}
          />
        </div>
      </div>

      <nav
        className="scroll-thin flex-1 overflow-y-auto px-2 pb-2 [-webkit-touch-callout:none] pointer-coarse:select-none"
        {...press.handlers}
        onClickCapture={(e) => {
          // 長押しで編集を開いたあとの click で、ビューが切り替わったりドロワーが閉じたりしないように
          if (press.consumeClick()) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <button
          type="button"
          className={rowClass("today")}
          onClick={() => onSelectView({ kind: "today" })}
          title="未読から、好み・話題・マイスタックで選んだ今日の分だけを読みます"
        >
          <Icon.Coffee className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate">今日の{dailyCount}本</span>
          <Count value={todayUnread} active={current === "today"} />
        </button>
        <button type="button" className={rowClass("all")} onClick={() => onSelectView({ kind: "all" })}>
          <Icon.Inbox className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate">すべての記事</span>
          <Count value={totalUnread} active={current === "all"} />
        </button>
        <button
          type="button"
          className={rowClass("starred")}
          onClick={() => onSelectView({ kind: "starred" })}
        >
          <Icon.Star className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate">スター付き</span>
          <Count value={starredCount} active={current === "starred"} />
        </button>
        <button
          type="button"
          className={rowClass("topic:ai")}
          onClick={() => onSelectView({ kind: "topic", id: "ai" })}
          title="購読中の全フィードから AI 関連の記事だけを集めます"
        >
          <Icon.Sparkle className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate">AI ニュース</span>
          <Count value={aiUnread} active={current === "topic:ai"} />
        </button>
        <button
          type="button"
          className={rowClass("trending")}
          onClick={() => onSelectView({ kind: "trending" })}
          title="複数のソースで取り上げられた・ブクマの多い記事を話題の順に並べます"
        >
          <Icon.Flame className="h-4 w-4 shrink-0 opacity-80" />
          <span className="truncate">話題</span>
          <Count value={trendingUnread} active={current === "trending"} />
        </button>
        <div className="group/row relative">
          <button
            type="button"
            data-longpress
            data-stack=""
            className={rowClass("stack")}
            onClick={() => (stackUnread === null ? onOpenStack() : onSelectView({ kind: "stack" }))}
            title="使っている技術に触れた記事と、そのリリース・セキュリティ情報をまとめます"
          >
            <Icon.Layers className="h-4 w-4 shrink-0 opacity-80" />
            <span className="truncate">マイスタック</span>
            {stackUnread === null ? (
              <span className="ml-auto shrink-0 text-2xs text-muted">登録する</span>
            ) : (
              <Count value={stackUnread} active={current === "stack"} />
            )}
          </button>
          {stackUnread !== null && (
            <button
              type="button"
              aria-label="マイスタックを編集"
              title="マイスタックを編集"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStack();
              }}
              className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded bg-surface p-1 text-muted hover:text-ink pointer-fine:group-hover/row:block"
            >
              <Icon.Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-1 pl-1.5 pr-1">
            <span className="flex-1 py-1 text-2xs font-semibold uppercase tracking-wider text-muted">ウォッチ</span>
            <button
              type="button"
              onClick={(e) => {
                // スマホのドロワーは中をタップすると閉じるので、入力欄を出すときは閉じさせない
                e.stopPropagation();
                setWatchDraft((d) => (d === null ? "" : null));
              }}
              aria-label="ウォッチするキーワードを追加"
              title="キーワードを追加"
              className="rounded p-1 text-muted hover:bg-line/60 hover:text-ink"
            >
              <Icon.Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {watchDraft !== null && (
            <form
              className="mb-1 space-y-1.5 rounded-lg border border-line bg-surface-2 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitWatch();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={watchDraft}
                onChange={(e) => setWatchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setWatchDraft(null);
                }}
                placeholder="例: Claude、Next.js"
                className="w-full rounded-md border border-line bg-surface px-2 py-1 text-ui outline-none placeholder:text-muted focus:border-accent"
              />
              <label className="flex items-center gap-1.5 text-2xs text-muted">
                <input
                  type="checkbox"
                  checked={watchNews}
                  onChange={(e) => setWatchNews(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Google ニュースの検索結果も購読する
              </label>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setWatchDraft(null)}
                  className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  やめる
                </button>
                <button
                  type="submit"
                  disabled={!watchDraft.trim()}
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </form>
          )}
          {watches.map((w) => {
            const key = `watch:${w.keyword}`;
            return (
              <div key={w.keyword} className="group/row relative">
                <button
                  type="button"
                  data-longpress
                  data-watch={w.keyword}
                  className={rowClass(key)}
                  onClick={() => onSelectView({ kind: "watch", keyword: w.keyword })}
                >
                  <Icon.Eye className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{w.keyword}</span>
                  <Count value={w.unread} active={current === key} />
                </button>
                <button
                  type="button"
                  aria-label={`ウォッチ「${w.keyword}」をやめる`}
                  title="ウォッチをやめる"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`ウォッチ「${w.keyword}」をやめますか？`)) onRemoveWatch(w.keyword);
                  }}
                  className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded bg-surface p-1 text-muted hover:text-danger pointer-fine:group-hover/row:block"
                >
                  <Icon.X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          {grouped.map((group) => {
            const isOpen = !collapsed.has(group.name);
            const folderKey = `folder:${group.name === UNCATEGORIZED ? "" : group.name}`;
            return (
              <div key={group.name}>
                <div className="group/folder flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    aria-label={isOpen ? "折りたたむ" : "展開する"}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(group.name)) next.add(group.name);
                        return next;
                      })
                    }
                    className="rounded p-0.5 text-muted hover:text-ink"
                  >
                    <Icon.Chevron className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  <button
                    type="button"
                    data-longpress
                    data-folder={group.name === UNCATEGORIZED ? "" : group.name}
                    onClick={() =>
                      onSelectView({ kind: "folder", name: group.name === UNCATEGORIZED ? "" : group.name })
                    }
                    className={`flex flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-2xs font-semibold uppercase tracking-wider transition-colors ${
                      current === folderKey ? "bg-accent-soft text-accent" : "text-muted hover:bg-line/50 hover:text-ink"
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
                    <Count value={group.unread} active={current === folderKey} />
                  </button>
                  <button
                    type="button"
                    aria-label={`フォルダ「${group.name}」を編集`}
                    title="フォルダを編集（右クリック・長押しでも開けます）"
                    onClick={() => onEditFolder(group.name === UNCATEGORIZED ? "" : group.name)}
                    className="hidden rounded p-1 text-muted hover:bg-line/60 hover:text-ink pointer-fine:group-hover/folder:block"
                  >
                    <Icon.Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    {group.feeds.map((feed) => {
                      const key = `feed:${feed.url}`;
                      const error = errors[feed.url];
                      return (
                        <div key={feed.url} className="group/row relative">
                          <button
                            type="button"
                            data-longpress
                            data-feed={feed.url}
                            onClick={() => onSelectView({ kind: "feed", url: feed.url })}
                            className={rowClass(key)}
                            title={error ? `更新エラー: ${error}` : feed.title}
                          >
                            <FeedIcon siteUrl={feed.siteUrl} title={feed.title} size={16} />
                            <span className="truncate">{feed.title}</span>
                            {error ? (
                              <span className="ml-auto shrink-0 text-2xs font-semibold text-danger">!</span>
                            ) : (
                              <Count value={unreadByFeed[feed.url] ?? 0} active={current === key} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`${feed.title} を編集`}
                            title="名前・フォルダの変更、購読解除（右クリック・長押しでも開けます）"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditFeed(feed.url);
                            }}
                            className="absolute right-1 top-1/2 hidden -translate-y-1/2 justify-center rounded bg-surface py-1 w-9 text-muted hover:text-ink pointer-fine:group-hover/row:flex"
                          >
                            <Icon.Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {feeds.length === 0 && (
          <p className="mt-6 px-2 text-xs leading-relaxed text-muted">
            まだ購読がありません。「フィードを追加」からサイトのURLを入れてみてください。
          </p>
        )}
      </nav>

      <div className="border-t border-line px-3 py-2">
        <div className="flex items-center gap-0.5 text-muted">
          <button
            type="button"
            onClick={onOpenPrefs}
            title="表示・翻訳・ミュート・好みの学習"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-ui hover:bg-line/60 hover:text-ink pointer-coarse:py-2.5"
          >
            <Icon.Sliders className="h-3.5 w-3.5" />
            設定
          </button>
          {/* たまにしか使わないものは「…」にしまう */}
          <PopMenu
            label="その他"
            align="left"
            placement="top"
            trigger={<Icon.Dots className="h-4 w-4" />}
            triggerClass="rounded-md p-1.5 hover:bg-line/60 hover:text-ink pointer-coarse:p-2.5"
            items={[
              {
                icon: isDark ? <Icon.Moon className="h-3.5 w-3.5" /> : <Icon.Sun className="h-3.5 w-3.5" />,
                label: `テーマ: ${THEME_LABEL[theme]}`,
                onSelect: onCycleTheme,
                keepOpen: true,
              },
              {
                icon: <Icon.Upload className="h-3.5 w-3.5" />,
                label: "OPML を読み込む",
                onSelect: () => fileInput.current?.click(),
              },
              { icon: <Icon.Download className="h-3.5 w-3.5" />, label: "OPML を書き出す", onSelect: onExportOpml },
              {
                icon: <Icon.Keyboard className="h-3.5 w-3.5" />,
                label: "ショートカット",
                hint: "?",
                onSelect: onShowShortcuts,
                fineOnly: true,
              },
            ]}
          />
          <span className="ml-auto truncate text-2xs tabular-nums">
            {lastUpdated ? `更新 ${new Date(lastUpdated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".opml,.xml,application/xml,text/xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportOpml(file);
            e.target.value = "";
          }}
        />
      </div>
    </aside>
  );
}

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  /** キーボードショートカット */
  hint?: string;
  onSelect: () => void;
  /** テーマの切り替えのように、続けて押せるよう開いたままにする */
  keepOpen?: boolean;
  /** マウス・キーボードのある環境でだけ出す */
  fineOnly?: boolean;
};

/** ボタンで開く小さなメニュー。外側を押すか Esc で閉じる */
function PopMenu({
  label,
  trigger,
  triggerClass,
  items,
  align,
  placement = "bottom",
}: {
  label: string;
  trigger: React.ReactNode;
  triggerClass: string;
  items: MenuItem[];
  align: "left" | "right";
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // スマホのドロワーは中をタップすると閉じるので、メニューの開閉では閉じさせない
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`${triggerClass} ${open ? "bg-line/60 text-ink" : ""}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-20 w-52 rounded-xl border border-line bg-surface p-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                if (item.keepOpen) e.stopPropagation();
                else setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ui text-ink/85 hover:bg-line/50 hover:text-ink pointer-coarse:py-2.5 ${
                item.fineOnly ? "pointer-coarse:hidden" : ""
              }`}
            >
              <span className="shrink-0 text-muted">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.hint && <kbd className="font-sans text-2xs text-muted">{item.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
