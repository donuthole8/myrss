"use client";

import { useMemo, useRef, useState } from "react";
import { UNCATEGORIZED, folderOf, type Theme } from "@/lib/store";
import { type Feed, type View, viewKey } from "@/lib/types";
import { FeedIcon, Icon, Spinner } from "./ui";

type Props = {
  feeds: Feed[];
  view: View;
  onSelectView: (view: View) => void;
  unreadByFeed: Record<string, number>;
  totalUnread: number;
  starredCount: number;
  errors: Record<string, string>;
  refreshing: boolean;
  lastUpdated: number | null;
  theme: Theme;
  isDark: boolean;
  onCycleTheme: () => void;
  onRefresh: () => void;
  onAddFeed: () => void;
  onRemoveFeed: (url: string) => void;
  onExportOpml: () => void;
  onImportOpml: (file: File) => void;
  onShowShortcuts: () => void;
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
      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        active ? "bg-accent-ink/15 text-current" : "bg-line/70 text-muted"
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
  starredCount,
  errors,
  refreshing,
  lastUpdated,
  theme,
  isDark,
  onCycleTheme,
  onRefresh,
  onAddFeed,
  onRemoveFeed,
  onExportOpml,
  onImportOpml,
  onShowShortcuts,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const current = viewKey(view);

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
    `group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
      current === key
        ? "bg-accent text-accent-ink font-medium"
        : "text-ink/85 hover:bg-line/50"
    }`;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <Icon.Rss className="h-4 w-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Reedly</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="すべて更新 (R)"
            aria-label="すべて更新"
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink disabled:opacity-50"
          >
            {refreshing ? <Spinner /> : <Icon.Refresh />}
          </button>
          <button
            type="button"
            onClick={onCycleTheme}
            title={`テーマ: ${THEME_LABEL[theme]}`}
            aria-label="テーマ切り替え"
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink"
          >
            {isDark ? <Icon.Moon /> : <Icon.Sun />}
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onAddFeed}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <Icon.Plus />
          フィードを追加
        </button>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
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

        <div className="mt-4 space-y-3">
          {grouped.map((group) => {
            const isOpen = !collapsed.has(group.name);
            const folderKey = `folder:${group.name === UNCATEGORIZED ? "" : group.name}`;
            return (
              <div key={group.name}>
                <div className="flex items-center gap-1 pr-1">
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
                    onClick={() =>
                      onSelectView({ kind: "folder", name: group.name === UNCATEGORIZED ? "" : group.name })
                    }
                    className={`flex flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      current === folderKey ? "text-accent" : "text-muted hover:text-ink"
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
                    <Count value={group.unread} active={false} />
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
                            onClick={() => onSelectView({ kind: "feed", url: feed.url })}
                            className={rowClass(key)}
                            title={error ? `更新エラー: ${error}` : feed.title}
                          >
                            <FeedIcon siteUrl={feed.siteUrl} title={feed.title} size={16} />
                            <span className="truncate">{feed.title}</span>
                            {error ? (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-red-500">!</span>
                            ) : (
                              <Count value={unreadByFeed[feed.url] ?? 0} active={current === key} />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`${feed.title} の購読を解除`}
                            onClick={() => {
                              if (window.confirm(`「${feed.title}」の購読を解除しますか？`)) {
                                onRemoveFeed(feed.url);
                              }
                            }}
                            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted hover:bg-line hover:text-red-500 group-hover/row:block"
                          >
                            <Icon.Trash className="h-3.5 w-3.5" />
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
        <div className="flex items-center gap-1 text-muted">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="OPMLを読み込む"
            className="rounded-md p-1.5 hover:bg-line/60 hover:text-ink"
          >
            <Icon.Upload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onExportOpml}
            title="OPMLを書き出す"
            className="rounded-md p-1.5 hover:bg-line/60 hover:text-ink"
          >
            <Icon.Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onShowShortcuts}
            title="キーボードショートカット (?)"
            className="rounded-md p-1.5 hover:bg-line/60 hover:text-ink"
          >
            <Icon.Keyboard className="h-3.5 w-3.5" />
          </button>
          <span className="ml-auto truncate text-[11px] tabular-nums">
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
