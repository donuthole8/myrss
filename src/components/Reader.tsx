"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { downloadFile, fromOpml, toOpml } from "@/lib/opml";
import {
  UNCATEGORIZED,
  loadState,
  saveState,
  subscribeSystemTheme,
  systemPrefersDark,
  type Persisted,
  type Theme,
} from "@/lib/store";
import type { Article, Candidate, Feed, FeedResult, View } from "@/lib/types";
import { AddFeedDialog } from "./AddFeedDialog";
import { ArticleList } from "./ArticleList";
import { ArticleView } from "./ArticleView";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";

const AUTO_REFRESH_MS = 15 * 60 * 1000;
const THEME_ORDER: Theme[] = ["system", "light", "dark"];

/** ssr:false で読み込まれる前提。初期値は localStorage から直接組み立てる */
export function Reader() {
  const [state, setState] = useState<Persisted>(loadState);
  const [articlesByFeed, setArticlesByFeed] = useState<Record<string, Article[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [view, setView] = useState<View>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---------- 永続化とテーマ ---------- */

  useEffect(() => {
    saveState(state);
  }, [state]);

  const theme = state.prefs.theme;
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false);
  const isDark = theme === "system" ? systemDark : theme === "dark";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /* ---------- 取得 ---------- */

  const refresh = useCallback(async (urls: string[], force: boolean) => {
    if (urls.length === 0) {
      setArticlesByFeed({});
      setErrors({});
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls, force }),
      });
      const data = (await res.json()) as { results?: FeedResult[] };
      const nextArticles: Record<string, Article[]> = {};
      const nextErrors: Record<string, string> = {};
      const meta: Array<Pick<Feed, "url" | "title" | "siteUrl">> = [];

      for (const result of data.results ?? []) {
        if (result.ok) {
          nextArticles[result.feed.url] = result.feed.articles;
          meta.push({
            url: result.feed.url,
            title: result.feed.title,
            siteUrl: result.feed.siteUrl,
          });
        } else {
          nextErrors[result.url] = result.error;
        }
      }

      setArticlesByFeed((prev) => ({ ...prev, ...nextArticles }));
      setErrors(nextErrors);
      setLastUpdated(Date.now());

      // 配信側の正式なタイトル / サイトURLに寄せる
      setState((prev) => {
        let changed = false;
        const feeds = prev.feeds.map((feed) => {
          const found = meta.find((m) => m.url === feed.url);
          if (!found) return feed;
          if (feed.title === found.title && feed.siteUrl === found.siteUrl) return feed;
          changed = true;
          return {
            ...feed,
            title: found.title || feed.title,
            siteUrl: found.siteUrl || feed.siteUrl,
          };
        });
        return changed ? { ...prev, feeds } : prev;
      });
    } catch {
      setToast("フィードの更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const feedUrls = useMemo(() => state.feeds.map((f) => f.url), [state.feeds]);
  const feedKey = feedUrls.join("\n");

  // 購読リストが変わったら取りに行く。取得は外部システムとの同期なので効果内で起動する
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(feedKey ? feedKey.split("\n") : [], false);
  }, [feedKey, refresh]);

  useEffect(() => {
    if (!feedKey) return;
    const id = window.setInterval(() => void refresh(feedKey.split("\n"), true), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [feedKey, refresh]);

  /* ---------- 派生データ ---------- */

  const readSet = useMemo(() => new Set(state.read), [state.read]);
  const starredIds = useMemo(() => new Set(state.starred.map((a) => a.id)), [state.starred]);

  const allArticles = useMemo(
    () =>
      Object.values(articlesByFeed)
        .flat()
        .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)),
    [articlesByFeed],
  );

  const unreadByFeed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [url, items] of Object.entries(articlesByFeed)) {
      counts[url] = items.reduce((sum, a) => sum + (readSet.has(a.id) ? 0 : 1), 0);
    }
    return counts;
  }, [articlesByFeed, readSet]);

  const totalUnread = useMemo(
    () => Object.values(unreadByFeed).reduce((a, b) => a + b, 0),
    [unreadByFeed],
  );

  const visible = useMemo(() => {
    let list: Article[];
    if (view.kind === "starred") {
      list = state.starred;
    } else if (view.kind === "feed") {
      list = articlesByFeed[view.url] ?? [];
    } else if (view.kind === "folder") {
      const urls = new Set(
        state.feeds.filter((f) => (f.folder || "") === view.name).map((f) => f.url),
      );
      list = allArticles.filter((a) => urls.has(a.feedUrl));
    } else {
      list = allArticles;
    }

    // 未読のみ表示でも、いま開いている記事は勝手に消えないようにする
    if (state.prefs.unreadOnly && view.kind !== "starred") {
      list = list.filter((a) => !readSet.has(a.id) || a.id === selectedId);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.feedTitle.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  }, [state, view, articlesByFeed, allArticles, readSet, query, selectedId]);

  const selected = useMemo(
    () => visible.find((a) => a.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const listTitle = useMemo(() => {
    switch (view.kind) {
      case "all":
        return "すべての記事";
      case "starred":
        return "スター付き";
      case "folder":
        return view.name || UNCATEGORIZED;
      case "feed":
        return state.feeds.find((f) => f.url === view.url)?.title ?? "フィード";
    }
  }, [state.feeds, view]);

  /* ---------- 操作 ---------- */

  const setRead = useCallback((id: string, read: boolean) => {
    setState((prev) => {
      const has = prev.read.includes(id);
      if (read === has) return prev;
      return { ...prev, read: read ? [...prev.read, id] : prev.read.filter((x) => x !== id) };
    });
  }, []);

  const openArticle = useCallback(
    (article: Article) => {
      setSelectedId(article.id);
      setRead(article.id, true);
    },
    [setRead],
  );

  const toggleStar = useCallback((article: Article) => {
    setState((prev) => {
      const exists = prev.starred.some((a) => a.id === article.id);
      return {
        ...prev,
        starred: exists
          ? prev.starred.filter((a) => a.id !== article.id)
          : [article, ...prev.starred],
      };
    });
  }, []);

  const markAllRead = useCallback(() => {
    const ids = visible.map((a) => a.id);
    setState((prev) => ({ ...prev, read: [...new Set([...prev.read, ...ids])] }));
  }, [visible]);

  const subscribe = useCallback((candidate: Candidate, folder: string) => {
    setState((prev) => {
      if (prev.feeds.some((f) => f.url === candidate.url)) return prev;
      const feed: Feed = {
        url: candidate.url,
        title: candidate.title,
        siteUrl: candidate.siteUrl,
        folder,
        addedAt: Date.now(),
      };
      return {
        ...prev,
        feeds: [...prev.feeds, feed],
        folders: folder ? [...new Set([...prev.folders, folder])] : prev.folders,
      };
    });
    setToast(`「${candidate.title}」を追加しました`);
  }, []);

  const removeFeed = useCallback(
    (url: string) => {
      setState((prev) => ({ ...prev, feeds: prev.feeds.filter((f) => f.url !== url) }));
      setArticlesByFeed((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
      if (view.kind === "feed" && view.url === url) setView({ kind: "all" });
    },
    [view],
  );

  const exportOpml = useCallback(() => {
    downloadFile("subscriptions.opml", toOpml(state.feeds, state.folders), "text/x-opml");
  }, [state.feeds, state.folders]);

  const importOpml = useCallback(async (file: File) => {
    let imported: ReturnType<typeof fromOpml>;
    try {
      imported = fromOpml(await file.text());
    } catch (err) {
      setToast(err instanceof Error ? err.message : "OPMLの読み込みに失敗しました");
      return;
    }

    let added = 0;
    setState((prev) => {
      const known = new Set(prev.feeds.map((f) => f.url));
      const fresh: Feed[] = [];
      for (const item of imported) {
        if (known.has(item.url)) continue;
        known.add(item.url);
        fresh.push({
          url: item.url,
          title: item.title,
          siteUrl: "",
          folder: item.folder,
          addedAt: Date.now(),
        });
      }
      added = fresh.length;
      if (added === 0) return prev;
      return {
        ...prev,
        feeds: [...prev.feeds, ...fresh],
        folders: [...new Set([...prev.folders, ...fresh.map((f) => f.folder).filter(Boolean)])],
      };
    });
    setToast(added > 0 ? `${added}件のフィードを取り込みました` : "新しいフィードはありませんでした");
  }, []);

  const cycleTheme = useCallback(() => {
    setState((prev) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(prev.prefs.theme) + 1) % THEME_ORDER.length];
      return { ...prev, prefs: { ...prev.prefs, theme: next } };
    });
  }, []);

  const toggleUnreadOnly = useCallback(() => {
    setState((prev) => ({ ...prev, prefs: { ...prev.prefs, unreadOnly: !prev.prefs.unreadOnly } }));
  }, []);

  /* ---------- キーボード ---------- */

  const move = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const index = visible.findIndex((a) => a.id === selectedId);
      const next = index === -1 ? (delta > 0 ? 0 : visible.length - 1) : index + delta;
      const target = visible[Math.max(0, Math.min(visible.length - 1, next))];
      if (target) openArticle(target);
    },
    [visible, selectedId, openArticle],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) {
        if (e.key === "Escape") {
          setQuery("");
          el.blur();
        }
        return;
      }
      if (addOpen || helpOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case "o":
        case "O":
        case "Enter":
          if (selected?.link) window.open(selected.link, "_blank", "noopener,noreferrer");
          break;
        case "m":
        case "M":
          if (selected) setRead(selected.id, !readSet.has(selected.id));
          break;
        case "s":
        case "S":
          if (selected) toggleStar(selected);
          break;
        case "u":
        case "U":
          toggleUnreadOnly();
          break;
        case "r":
        case "R":
          if (feedKey) void refresh(feedKey.split("\n"), true);
          break;
        case "a":
        case "A":
          e.preventDefault();
          setAddOpen(true);
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "Escape":
          setSelectedId(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    addOpen,
    helpOpen,
    move,
    selected,
    readSet,
    setRead,
    toggleStar,
    toggleUnreadOnly,
    refresh,
    feedKey,
  ]);

  /* ---------- 描画 ---------- */

  return (
    <div className="app-shell relative flex h-dvh overflow-hidden">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`${navOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-40 md:static md:z-auto md:flex`}
        onClick={() => setNavOpen(false)}
      >
        <Sidebar
          feeds={state.feeds}
          view={view}
          onSelectView={(next) => {
            setView(next);
            setSelectedId(null);
            setQuery("");
          }}
          unreadByFeed={unreadByFeed}
          totalUnread={totalUnread}
          starredCount={state.starred.length}
          errors={errors}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          theme={state.prefs.theme}
          isDark={isDark}
          onCycleTheme={cycleTheme}
          onRefresh={() => void refresh(feedUrls, true)}
          onAddFeed={() => setAddOpen(true)}
          onRemoveFeed={removeFeed}
          onExportOpml={exportOpml}
          onImportOpml={(file) => void importOpml(file)}
          onShowShortcuts={() => setHelpOpen(true)}
        />
      </div>

      <ArticleList
        className={selected ? "max-md:hidden" : ""}
        title={listTitle}
        articles={visible}
        selectedId={selectedId}
        onSelect={openArticle}
        isRead={(id) => readSet.has(id)}
        isStarred={(id) => starredIds.has(id)}
        onToggleStar={toggleStar}
        query={query}
        onQueryChange={setQuery}
        unreadOnly={state.prefs.unreadOnly}
        onToggleUnreadOnly={toggleUnreadOnly}
        onMarkAllRead={markAllRead}
        loading={refreshing}
        searchRef={searchRef}
        onOpenNav={() => setNavOpen(true)}
      />

      <ArticleView
        className={selected ? "max-md:flex" : ""}
        article={selected}
        isRead={selected ? readSet.has(selected.id) : false}
        isStarred={selected ? starredIds.has(selected.id) : false}
        onToggleStar={toggleStar}
        onToggleRead={(a) => setRead(a.id, !readSet.has(a.id))}
        onClose={() => setSelectedId(null)}
      />

      {addOpen && (
        <AddFeedDialog
          folders={state.folders}
          subscribedUrls={new Set(feedUrls)}
          onClose={() => setAddOpen(false)}
          onSubscribe={subscribe}
        />
      )}
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line bg-surface px-4 py-2 text-[13px] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
