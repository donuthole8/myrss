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
  SORT_ORDER,
  UNCATEGORIZED,
  WATCH_FOLDER,
  googleNewsUrl,
  loadState,
  pruneFolders,
  saveState,
  subscribeSystemTheme,
  systemPrefersDark,
  type Persisted,
  type Theme,
} from "@/lib/store";
import { buildRelatedIndex, relatedTo } from "@/lib/related";
import { buildStories, heatOf, isHot, leadOf, normalizeLink } from "@/lib/stories";
import { loadHistory, record, rising, saveHistory, type TrendHistory } from "@/lib/trends";
import {
  HIDE_BELOW,
  INTEREST_BOOST,
  emptyModel,
  featuresOf,
  isTrained,
  learn,
  loadModel,
  matchesAny,
  saveModel,
  scoreOf,
  type Model,
  type Signal,
} from "@/lib/prefer";
import { aiFeedUrls, isAiArticle } from "@/lib/topics";
import {
  loadTranslations,
  needsTranslation,
  requestTranslations,
  saveTranslations,
  summarySnippet,
  type Translations,
} from "@/lib/translate";
import { isKnown, loadOgp, needsOgp, requestOgp, saveOgp, withOgp, type OgpCache } from "@/lib/ogp";
import type { Article, Buzz, Candidate, Feed, FeedResult, View } from "@/lib/types";
import { AddFeedDialog } from "./AddFeedDialog";
import { FeedCatalog } from "./FeedCatalog";
import { ArticleList } from "./ArticleList";
import { ArticleView } from "./ArticleView";
import { EditFeedDialog, EditFolderDialog } from "./EditDialogs";
import { PrefsDialog } from "./PrefsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";

const AUTO_REFRESH_MS = 15 * 60 * 1000;
const THEME_ORDER: Theme[] = ["system", "light", "dark"];
/** 話題ランキングに載せるのはこの期間に出た記事まで */
const TRENDING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
/** はてブ数を聞き直すまでの間隔 */
const BUZZ_TTL_MS = 30 * 60 * 1000;
const BUZZ_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** スマホの1ペイン表示か。このときだけ記事を開いたら履歴を積んで、戻るボタンで一覧に戻れるようにする */
function isNarrow(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

type Editing = { kind: "feed"; url: string } | { kind: "folder"; name: string } | null;

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
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [model, setModel] = useState<Model>(loadModel);
  const [translations, setTranslations] = useState<Translations>(loadTranslations);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translateDisabled, setTranslateDisabled] = useState(false);
  /** 一度投げたタイトル。失敗したものを延々と投げ直さないため */
  const attempted = useRef(new Set<string>());
  const [ogp, setOgp] = useState<OgpCache>(loadOgp);
  /** OGP を問い合わせ中・問い合わせ済みの記事URL */
  const ogpAsked = useRef(new Set<string>());
  const [navOpen, setNavOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  /** 記事URL -> はてブ数 */
  const [hatena, setHatena] = useState<Record<string, number>>({});
  /** 記事URL -> Qiita / Zenn のいいね数 */
  const [likes, setLikes] = useState<Record<string, number>>({});
  const buzzAsked = useRef(new Map<string, number>());
  const [history, setHistory] = useState<TrendHistory>(loadHistory);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---------- 永続化とテーマ ---------- */

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    saveModel(model);
  }, [model]);

  useEffect(() => {
    saveTranslations(translations);
  }, [translations]);

  useEffect(() => {
    saveOgp(ogp);
  }, [ogp]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

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
          // 自分で付けた名前は残す
          const title = feed.renamed ? feed.title : found.title || feed.title;
          const siteUrl = found.siteUrl || feed.siteUrl;
          if (feed.title === title && feed.siteUrl === siteUrl) return feed;
          changed = true;
          return { ...feed, title, siteUrl };
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

  // 名前を付け替えたフィードは、記事側のフィード名もそれに合わせる
  // 表示名の上書きと、OGP で補った画像・要約をここで載せる。以降はすべてこれを使う
  const namedByFeed = useMemo(() => {
    const renamed = new Map(state.feeds.filter((f) => f.renamed).map((f) => [f.url, f.title]));
    const next: Record<string, Article[]> = {};
    for (const [url, items] of Object.entries(articlesByFeed)) {
      const title = renamed.get(url);
      next[url] = items.map((a) => withOgp(title ? { ...a, feedTitle: title } : a, ogp));
    }
    return next;
  }, [articlesByFeed, state.feeds, ogp]);

  const feedTitles = useMemo(
    () => new Map(state.feeds.map((f) => [f.url, f.title])),
    [state.feeds],
  );

  // 別フィードに流れてきた同じ記事・同じ話題を束ねる
  const { storyOf, stories } = useMemo(
    () => buildStories(Object.values(namedByFeed).flat(), hatena),
    [namedByFeed, hatena],
  );

  const readSet = useMemo(() => new Set(state.read), [state.read]);
  const starredIds = useMemo(() => new Set(state.starred.map((a) => a.id)), [state.starred]);

  // どれか1つを読めば、同じ話題の記事はすべて既読扱い
  const readStories = useMemo(() => {
    const keys = new Set<string>();
    for (const id of state.read) {
      const key = storyOf.get(id);
      if (key) keys.add(key);
    }
    return keys;
  }, [state.read, storyOf]);
  const isRead = useCallback(
    (id: string) => readSet.has(id) || readStories.has(storyOf.get(id) ?? ""),
    [readSet, readStories, storyOf],
  );

  const storyFor = useCallback(
    (article: Article) => stories.get(storyOf.get(article.id) ?? ""),
    [stories, storyOf],
  );
  const sourcesOf = useCallback(
    (article: Article): string[] => {
      const story = storyFor(article);
      if (!story || story.feeds.size < 2) return [];
      return [...story.feeds]
        .filter((url) => url !== article.feedUrl)
        .map((url) => feedTitles.get(url) ?? url);
    },
    [storyFor, feedTitles],
  );
  const buzzOf = useCallback(
    (article: Article): Buzz | undefined => {
      const buzz =
        storyFor(article)?.buzz ??
        (article.link && hatena[article.link] !== undefined
          ? { ...article.buzz, hatena: hatena[article.link] }
          : article.buzz);
      const liked = article.link ? likes[article.link] : undefined;
      return liked === undefined ? buzz : { ...buzz, likes: liked };
    },
    [storyFor, hatena, likes],
  );

  const translate = state.prefs.translate;
  const titleJa = useCallback(
    (article: Article): string | undefined =>
      translate && needsTranslation(article.title) ? translations[article.title] : undefined,
    [translate, translations],
  );

  const { mute, interest } = state.filters;
  const isMuted = useCallback(
    (article: Article) => matchesAny(`${article.title}\n${titleJa(article) ?? ""}`, mute),
    [mute, titleJa],
  );

  const aiFeeds = useMemo(() => aiFeedUrls(state.feeds), [state.feeds]);
  const trained = isTrained(model);

  // Qiita の AI タグと LLM タグのように、同じ記事が複数フィードに出るので元記事URLで畳む
  const allArticles = useMemo(() => {
    const seen = new Set<string>();
    return Object.values(namedByFeed)
      .flat()
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .filter((a) => {
        const key = normalizeLink(a.link) || a.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [namedByFeed]);

  const now = lastUpdated ?? 0;
  const trending = useMemo(
    () =>
      [...stories.values()]
        .filter(
          (s) => isHot(s) && s.publishedAt !== null && now - s.publishedAt <= TRENDING_WINDOW_MS,
        )
        .sort((a, b) => heatOf(b, now) - heatOf(a, now))
        .map(leadOf),
    [stories, now],
  );

  const watchMatches = useCallback(
    (article: Article, keyword: string) => {
      const watch = state.watches.find((w) => w.keyword === keyword);
      if (watch?.feedUrl && article.feedUrl === watch.feedUrl) return true;
      return matchesAny(`${article.title}\n${titleJa(article) ?? ""}\n${article.summary}`, [keyword]);
    },
    [state.watches, titleJa],
  );

  const scores = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of [...allArticles, ...state.starred]) {
      if (map.has(a.id)) continue;
      const ja = titleJa(a);
      const text = `${a.title}\n${ja ?? ""}\n${a.summary.slice(0, 300)}`;
      const boost = interest.filter((k) => matchesAny(text, [k])).length * INTEREST_BOOST;
      map.set(a.id, scoreOf(model, featuresOf(a, ja)) + boost);
    }
    return map;
  }, [allArticles, state.starred, titleJa, interest, model]);

  // ミュートした記事は未読数にも数えない
  const unreadByFeed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [url, items] of Object.entries(namedByFeed)) {
      counts[url] = items.reduce(
        (sum, a) => sum + (isRead(a.id) || isMuted(a) ? 0 : 1),
        0,
      );
    }
    return counts;
  }, [namedByFeed, isRead, isMuted]);

  const aiUnread = useMemo(
    () =>
      allArticles.filter(
        (a) => !isRead(a.id) && !isMuted(a) && isAiArticle(a, aiFeeds, titleJa(a)),
      ).length,
    [allArticles, isRead, isMuted, aiFeeds, titleJa],
  );

  const trendingUnread = useMemo(
    () => trending.filter((a) => !isRead(a.id) && !isMuted(a)).length,
    [trending, isRead, isMuted],
  );

  const watchCounts = useMemo(
    () =>
      state.watches.map((w) => ({
        keyword: w.keyword,
        unread: allArticles.filter(
          (a) => !isRead(a.id) && !isMuted(a) && watchMatches(a, w.keyword),
        ).length,
      })),
    [state.watches, allArticles, isRead, isMuted, watchMatches],
  );

  const totalUnread = useMemo(
    () => Object.values(unreadByFeed).reduce((a, b) => a + b, 0),
    [unreadByFeed],
  );

  const { visible, hiddenCount } = useMemo(() => {
    let list: Article[];
    if (view.kind === "starred") {
      list = state.starred;
    } else if (view.kind === "topic") {
      list = allArticles.filter((a) => isAiArticle(a, aiFeeds, titleJa(a)));
    } else if (view.kind === "trending") {
      list = trending;
    } else if (view.kind === "watch") {
      list = allArticles.filter((a) => watchMatches(a, view.keyword));
    } else if (view.kind === "feed") {
      list = namedByFeed[view.url] ?? [];
    } else if (view.kind === "folder") {
      const urls = new Set(
        state.feeds.filter((f) => (f.folder || "") === view.name).map((f) => f.url),
      );
      list = allArticles.filter((a) => urls.has(a.feedUrl));
    } else {
      list = allArticles;
    }

    // いま開いている記事は、どの絞り込みでも勝手に消えないようにする
    const keep = (a: Article) => a.id === selectedId;
    const ranked = view.kind === "starred" || view.kind === "trending";
    const recommended = state.prefs.sort === "recommended" && !ranked;
    const buzz = state.prefs.sort === "buzz" && !ranked;
    let hidden = 0;
    const hide = (predicate: (a: Article) => boolean) => {
      const before = list.length;
      list = list.filter((a) => keep(a) || !predicate(a));
      hidden += before - list.length;
    };

    if (view.kind !== "starred") hide(isMuted);
    // 学習が浅いうちは並べ替えだけにする
    if (recommended && trained) hide((a) => (scores.get(a.id) ?? 0) < HIDE_BELOW);

    if (state.prefs.unreadOnly && view.kind !== "starred") {
      list = list.filter((a) => keep(a) || !isRead(a.id));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (titleJa(a) ?? "").toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.feedTitle.toLowerCase().includes(q),
      );
    }
    const byDate = (a: Article, b: Article) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    const heat = (a: Article) => {
      const story = storyFor(a);
      return story ? heatOf(story, now) : 0;
    };
    // 話題ビューは作った時点で話題順に並んでいる
    const sorted =
      view.kind === "trending"
        ? list
        : recommended
          ? [...list].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || byDate(a, b))
          : buzz
            ? [...list].sort((a, b) => heat(b) - heat(a) || byDate(a, b))
            : [...list].sort(byDate);
    return { visible: sorted, hiddenCount: hidden };
  }, [
    state,
    view,
    namedByFeed,
    allArticles,
    trending,
    watchMatches,
    storyFor,
    now,
    isRead,
    query,
    selectedId,
    aiFeeds,
    titleJa,
    isMuted,
    scores,
    trained,
  ]);

  /* ---------- 翻訳 ---------- */

  /* ---------- OGP ---------- */

  // 表示中の記事のうち、画像か要約が欠けているものの元記事から OGP を取る
  useEffect(() => {
    const now = Date.now();
    const batch = [
      ...new Set(
        visible
          .filter((a) => needsOgp(a) && !isKnown(ogp, a.link, now) && !ogpAsked.current.has(a.link))
          .map((a) => a.link),
      ),
    ].slice(0, 40);
    if (batch.length === 0) return;
    for (const link of batch) ogpAsked.current.add(link);
    void requestOgp(batch).then((results) => {
      if (!results) return;
      const at = Date.now();
      setOgp((prev) => {
        const next = { ...prev };
        for (const link of batch) next[link] = { ...(results[link] ?? {}), at };
        return next;
      });
    });
  }, [visible, ogp]);

  const untranslated = useMemo(() => {
    if (!translate || translateDisabled) return [];
    const titles = visible
      .map((a) => a.title)
      .filter((t) => needsTranslation(t) && !(t in translations));
    return [...new Set(titles)];
  }, [visible, translate, translateDisabled, translations]);

  const runTranslations = useCallback((texts: string[]) => {
    const batch = texts.filter((t) => !attempted.current.has(t)).slice(0, 50);
    if (batch.length === 0) return;
    for (const t of batch) attempted.current.add(t);
    void requestTranslations(batch).then((outcome) => {
      if (outcome.ok) {
        setTranslations((prev) => ({ ...prev, ...outcome.translations }));
        return;
      }
      setTranslateError(outcome.error);
      if (outcome.disabled) {
        setTranslateDisabled(true);
        setToast(outcome.error);
      }
    });
  }, []);

  // 表示中の英語タイトルを50件ずつ訳す。訳が届くと untranslated が縮んで次の束に進む
  useEffect(() => {
    runTranslations(untranslated);
  }, [untranslated, runTranslations]);

  // 抜粋は長く無料枠を食うので、画面に出た行の、見えている2行分だけを訳す
  const summaryJa = useCallback(
    (article: Article) => {
      if (!translate) return undefined;
      const snippet = summarySnippet(article.summary);
      return snippet ? translations[snippet] : undefined;
    },
    [translate, translations],
  );
  const [summaryQueue, setSummaryQueue] = useState<string[]>([]);
  const onSummariesShown = useCallback(
    (articles: Article[]) => {
      if (!translate || translateDisabled) return;
      const snippets = articles
        .map((a) => summarySnippet(a.summary))
        .filter((t): t is string => !!t && !(t in translations) && !attempted.current.has(t));
      if (snippets.length > 0) setSummaryQueue((prev) => [...new Set([...prev, ...snippets])]);
    },
    [translate, translateDisabled, translations],
  );
  useEffect(() => {
    if (summaryQueue.length === 0) return;
    // スクロール中に細切れで投げず、止まってからまとめて訳す
    const timer = window.setTimeout(() => {
      setSummaryQueue([]);
      runTranslations(summaryQueue);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [summaryQueue, runTranslations]);

  /* ---------- 話題度と急上昇キーワード ---------- */

  // どのフィードの記事にもはてブ数を付ける。同じURLは30分は聞き直さない
  useEffect(() => {
    if (!lastUpdated) return;
    const asked = buzzAsked.current;
    const urls = allArticles
      .filter(
        (a) =>
          a.link &&
          a.publishedAt !== null &&
          lastUpdated - a.publishedAt <= BUZZ_MAX_AGE_MS &&
          lastUpdated - (asked.get(a.link) ?? 0) > BUZZ_TTL_MS,
      )
      .map((a) => a.link)
      .slice(0, 600);
    if (urls.length === 0) return;
    for (const url of urls) asked.set(url, lastUpdated);
    void fetch("/api/buzz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{ counts?: Record<string, number>; likes?: Record<string, number> }>)
          : null,
      )
      .then((data) => {
        if (data?.counts) setHatena((prev) => ({ ...prev, ...data.counts }));
        if (data?.likes && Object.keys(data.likes).length > 0) setLikes((prev) => ({ ...prev, ...data.likes }));
      })
      .catch(() => {
        /* はてブ数は無くても困らない */
      });
  }, [allArticles, lastUpdated]);

  // 取得した記事のタイトルを日ごとに数えて貯める
  useEffect(() => {
    if (!lastUpdated || allArticles.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory((prev) =>
      record(
        prev,
        allArticles.map((a) => ({
          key: normalizeLink(a.link) || a.id,
          title: a.title,
          publishedAt: a.publishedAt,
        })),
        lastUpdated,
      ),
    );
  }, [allArticles, lastUpdated]);

  const keywords = useMemo(
    () => (lastUpdated ? rising(history, lastUpdated) : []),
    [history, lastUpdated],
  );

  // 関連記事から開いた記事は今の一覧に無いことがあるので、購読全体とスターからも探す
  const relatedIndex = useMemo(
    () => buildRelatedIndex([...allArticles, ...state.starred], titleJa),
    [allArticles, state.starred, titleJa],
  );

  const selected = useMemo(
    () =>
      visible.find((a) => a.id === selectedId) ??
      (selectedId ? relatedIndex.byId.get(selectedId) ?? null : null),
    [visible, selectedId, relatedIndex],
  );

  const related = useMemo(() => {
    if (!selected) return [];
    const sameStory = new Set(storyFor(selected)?.articles.map((a) => a.id));
    return relatedTo(relatedIndex, selected, sameStory);
  }, [selected, relatedIndex, storyFor]);

  const listTitle = useMemo(() => {
    switch (view.kind) {
      case "all":
        return "すべての記事";
      case "starred":
        return "スター付き";
      case "topic":
        return "AI ニュース";
      case "trending":
        return "話題";
      case "watch":
        return `ウォッチ: ${view.keyword}`;
      case "folder":
        return view.name || UNCATEGORIZED;
      case "feed":
        return state.feeds.find((f) => f.url === view.url)?.title ?? "フィード";
    }
  }, [state.feeds, view]);

  /* ---------- 操作 ---------- */

  const setRead = useCallback(
    (id: string, read: boolean) => {
      if (read) {
        setState((prev) => (prev.read.includes(id) ? prev : { ...prev, read: [...prev.read, id] }));
        return;
      }
      // 未読に戻すときは、同じ話題の記事の既読もまとめて外す
      const key = storyOf.get(id);
      const ids = new Set(key ? stories.get(key)?.articles.map((a) => a.id) : undefined);
      ids.add(id);
      setState((prev) => {
        const next = prev.read.filter((x) => !ids.has(x));
        return next.length === prev.read.length ? prev : { ...prev, read: next };
      });
    },
    [storyOf, stories],
  );

  const toggleRead = useCallback(
    (article: Article) => setRead(article.id, !isRead(article.id)),
    [setRead, isRead],
  );

  const teach = useCallback(
    (articles: Article[], signal: Signal) => {
      if (articles.length === 0) return;
      setModel((prev) =>
        articles.reduce((m, a) => learn(m, featuresOf(a, titleJa(a)), signal), prev),
      );
    },
    [titleJa],
  );

  const openArticle = useCallback(
    (article: Article) => {
      // 初めて開いたときだけ「気になった」として学習する
      if (!isRead(article.id)) teach([article], "open");
      // スマホでは一覧→本文を1画面ずつ見せるので、端末の戻る操作で一覧に戻れるようにする
      if (isNarrow() && !window.history.state?.reedlyArticle) {
        window.history.pushState({ ...window.history.state, reedlyArticle: true }, "");
      }
      setSelectedId(article.id);
      setRead(article.id, true);
    },
    [setRead, isRead, teach],
  );

  // 一覧のクリックは元記事へ直行する。アプリ内の本文ビューは J / K で読むときに使う
  const visitArticle = useCallback(
    (article: Article) => {
      if (!article.link) {
        openArticle(article);
        return;
      }
      window.open(article.link, "_blank", "noopener,noreferrer");
      if (!isRead(article.id)) teach([article], "open");
      setRead(article.id, true);
      // PC は選択を移して J / K の起点にする。スマホは本文画面に切り替えず、戻ってきたら一覧のまま
      if (!isNarrow()) setSelectedId(article.id);
    },
    [openArticle, isRead, teach, setRead],
  );

  const closeArticle = useCallback(() => {
    if (window.history.state?.reedlyArticle) window.history.back();
    else setSelectedId(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!window.history.state?.reedlyArticle) setSelectedId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const toggleStar = useCallback((article: Article) => {
    if (!starredIds.has(article.id)) teach([article], "star");
    setState((prev) => {
      const exists = prev.starred.some((a) => a.id === article.id);
      return {
        ...prev,
        starred: exists
          ? prev.starred.filter((a) => a.id !== article.id)
          : [article, ...prev.starred],
      };
    });
  }, [starredIds, teach]);

  const markAllRead = useCallback(() => {
    // 開かずに流したものは「そこまで興味がない」として弱めに学習する
    teach(
      visible.filter((a) => !isRead(a.id)),
      "skip",
    );
    const ids = visible.map((a) => a.id);
    setState((prev) => ({ ...prev, read: [...new Set([...prev.read, ...ids])] }));
  }, [visible, isRead, teach]);

  const dislike = useCallback(
    (article: Article) => {
      const index = visible.findIndex((a) => a.id === article.id);
      const next = visible[index + 1] ?? null;
      teach([article], "dislike");
      setRead(article.id, true);
      setSelectedId(next?.id ?? null);
      if (next) setRead(next.id, true);
      setToast("似た記事をおすすめしにくくします");
    },
    [visible, teach, setRead],
  );

  const subscribe = useCallback((candidates: Candidate[], folder: string) => {
    let added = 0;
    setState((prev) => {
      const known = new Set(prev.feeds.map((f) => f.url));
      const fresh: Feed[] = candidates
        .filter((c) => !known.has(c.url))
        .map((c) => ({
          url: c.url,
          title: c.title,
          siteUrl: c.siteUrl,
          folder,
          addedAt: Date.now(),
        }));
      added = fresh.length;
      if (added === 0) return prev;
      return {
        ...prev,
        feeds: [...prev.feeds, ...fresh],
        folders: folder ? [...new Set([...prev.folders, folder])] : prev.folders,
      };
    });
    setToast(
      candidates.length === 1
        ? `「${candidates[0].title}」を追加しました`
        : added > 0
          ? `${added}件のフィードを追加しました`
          : "すべて購読済みです",
    );
  }, []);

  const removeFeeds = useCallback(
    (urls: string[]) => {
      const gone = new Set(urls);
      setState((prev) => {
        const feeds = prev.feeds.filter((f) => !gone.has(f.url));
        return {
          ...prev,
          feeds,
          folders: pruneFolders(prev.folders, feeds),
          // ウォッチ用のフィードだけ消されたら、キーワードでの横断は続ける
          watches: prev.watches.map((w) =>
            w.feedUrl && gone.has(w.feedUrl) ? { ...w, feedUrl: null } : w,
          ),
        };
      });
      setArticlesByFeed((prev) => {
        const next = { ...prev };
        for (const url of gone) delete next[url];
        return next;
      });
      if (view.kind === "feed" && gone.has(view.url)) setView({ kind: "all" });
    },
    [view],
  );

  const editFeed = useCallback((url: string, changes: { title: string; folder: string }) => {
    setState((prev) => {
      const feeds = prev.feeds.map((f) =>
        f.url === url
          ? {
              ...f,
              // 空にしたら配信元の名前に戻す (次の更新で取り直す)
              title: changes.title || f.title,
              renamed: changes.title !== "",
              folder: changes.folder,
            }
          : f,
      );
      const folders = changes.folder ? [...new Set([...prev.folders, changes.folder])] : prev.folders;
      return { ...prev, feeds, folders: pruneFolders(folders, feeds) };
    });
  }, []);

  /** フォルダの付け替え。to が既存のフォルダなら合流、空なら未分類 */
  const moveFolder = useCallback(
    (from: string, to: string) => {
      setState((prev) => {
        const feeds = prev.feeds.map((f) => ((f.folder || "") === from ? { ...f, folder: to } : f));
        const folders = to ? [...new Set([...prev.folders, to])] : prev.folders;
        return { ...prev, feeds, folders: pruneFolders(folders, feeds) };
      });
      if (view.kind === "folder" && view.name === from) setView({ kind: "folder", name: to });
    },
    [view],
  );

  const addWatch = useCallback(
    (keyword: string, withNews: boolean) => {
      const exists = state.watches.some((w) => w.keyword.toLowerCase() === keyword.toLowerCase());
      if (!exists) {
        const feedUrl = withNews ? googleNewsUrl(keyword) : null;
        setState((prev) => {
          const feed: Feed | null =
            feedUrl && !prev.feeds.some((f) => f.url === feedUrl)
              ? {
                  url: feedUrl,
                  title: `Google ニュース: ${keyword}`,
                  siteUrl: "https://news.google.com",
                  folder: WATCH_FOLDER,
                  addedAt: Date.now(),
                  renamed: true,
                }
              : null;
          return {
            ...prev,
            watches: [...prev.watches, { keyword, feedUrl }],
            feeds: feed ? [...prev.feeds, feed] : prev.feeds,
            folders: feed ? [...new Set([...prev.folders, WATCH_FOLDER])] : prev.folders,
          };
        });
      }
      setView({ kind: "watch", keyword });
      setSelectedId(null);
      setQuery("");
    },
    [state.watches],
  );

  const removeWatch = useCallback(
    (keyword: string) => {
      const watch = state.watches.find((w) => w.keyword === keyword);
      setState((prev) => ({ ...prev, watches: prev.watches.filter((w) => w.keyword !== keyword) }));
      if (watch?.feedUrl) removeFeeds([watch.feedUrl]);
      if (view.kind === "watch" && view.keyword === keyword) setView({ kind: "all" });
    },
    [state.watches, removeFeeds, view],
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

  const toggleSort = useCallback(() => {
    setState((prev) => ({
      ...prev,
      prefs: {
        ...prev.prefs,
        sort: SORT_ORDER[(SORT_ORDER.indexOf(prev.prefs.sort) + 1) % SORT_ORDER.length],
      },
    }));
  }, []);

  const toggleTranslate = useCallback(() => {
    setState((prev) => ({ ...prev, prefs: { ...prev.prefs, translate: !prev.prefs.translate } }));
  }, []);

  const setPref = useCallback(
    <K extends keyof Persisted["prefs"]>(key: K, value: Persisted["prefs"][K]) => {
      setState((prev) => ({ ...prev, prefs: { ...prev.prefs, [key]: value } }));
    },
    [],
  );

  const saveFilters = useCallback((filters: Persisted["filters"]) => {
    setState((prev) => ({ ...prev, filters }));
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
      if (addOpen || helpOpen || prefsOpen || catalogOpen || editing || e.metaKey || e.ctrlKey || e.altKey) return;

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
          if (selected) toggleRead(selected);
          break;
        case "s":
        case "S":
          if (selected) toggleStar(selected);
          break;
        case "d":
        case "D":
          if (selected) dislike(selected);
          break;
        case "u":
        case "U":
          toggleUnreadOnly();
          break;
        case "p":
        case "P":
          toggleSort();
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
          if (selected) closeArticle();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    addOpen,
    helpOpen,
    prefsOpen,
    catalogOpen,
    editing,
    closeArticle,
    toggleRead,
    dislike,
    toggleSort,
    move,
    selected,
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
            if (selected) closeArticle();
            setQuery("");
          }}
          unreadByFeed={unreadByFeed}
          totalUnread={totalUnread}
          aiUnread={aiUnread}
          trendingUnread={trendingUnread}
          watches={watchCounts}
          onAddWatch={addWatch}
          onRemoveWatch={removeWatch}
          starredCount={state.starred.length}
          errors={errors}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          theme={state.prefs.theme}
          isDark={isDark}
          onCycleTheme={cycleTheme}
          onRefresh={() => void refresh(feedUrls, true)}
          onAddFeed={() => setAddOpen(true)}
          onBrowseCatalog={() => setCatalogOpen(true)}
          onEditFeed={(url) => setEditing({ kind: "feed", url })}
          onEditFolder={(name) => setEditing({ kind: "folder", name })}
          onExportOpml={exportOpml}
          onImportOpml={(file) => void importOpml(file)}
          onShowShortcuts={() => setHelpOpen(true)}
          onOpenPrefs={() => setPrefsOpen(true)}
        />
      </div>

      <ArticleList
        className={selected ? "max-md:hidden" : ""}
        title={listTitle}
        articles={visible}
        selectedId={selectedId}
        onSelect={visitArticle}
        translatedTitle={titleJa}
        translatedSummary={summaryJa}
        onSummariesShown={onSummariesShown}
        isRead={isRead}
        isStarred={(id) => starredIds.has(id)}
        onToggleStar={toggleStar}
        onToggleRead={toggleRead}
        sourcesOf={sourcesOf}
        buzzOf={buzzOf}
        keywords={view.kind === "all" || view.kind === "trending" ? keywords : null}
        onPickKeyword={setQuery}
        onRefresh={() => void refresh(feedUrls, true)}
        query={query}
        onQueryChange={setQuery}
        unreadOnly={state.prefs.unreadOnly}
        onToggleUnreadOnly={toggleUnreadOnly}
        onMarkAllRead={markAllRead}
        sort={view.kind === "starred" || view.kind === "trending" ? null : state.prefs.sort}
        onToggleSort={toggleSort}
        hiddenCount={hiddenCount}
        training={trained ? null : model.events}
        loading={refreshing}
        searchRef={searchRef}
        onOpenNav={() => setNavOpen(true)}
        density={state.prefs.density}
        onBrowseCatalog={() => setCatalogOpen(true)}
      />

      <ArticleView
        className={selected ? "max-md:flex" : ""}
        article={selected}
        translatedTitle={selected ? titleJa(selected) : undefined}
        isRead={selected ? isRead(selected.id) : false}
        isStarred={selected ? starredIds.has(selected.id) : false}
        onToggleStar={toggleStar}
        onToggleRead={toggleRead}
        onDislike={dislike}
        onClose={closeArticle}
        onNext={selected && visible[visible.length - 1]?.id !== selected.id ? () => move(1) : undefined}
        sources={selected ? sourcesOf(selected) : []}
        buzz={selected ? buzzOf(selected) : undefined}
        related={related}
        titleJa={titleJa}
        isArticleRead={isRead}
        onOpenRelated={openArticle}
        readingSize={state.prefs.readingSize}
        readingFont={state.prefs.readingFont}
        onChangeReadingSize={(size) => setPref("readingSize", size)}
        onChangeReadingFont={(font) => setPref("readingFont", font)}
      />

      {addOpen && (
        <AddFeedDialog
          folders={state.folders}
          subscribedUrls={new Set(feedUrls)}
          onClose={() => setAddOpen(false)}
          onSubscribe={subscribe}
          onBrowse={() => {
            setAddOpen(false);
            setCatalogOpen(true);
          }}
        />
      )}
      {catalogOpen && (
        <FeedCatalog
          subscribedUrls={new Set(feedUrls)}
          onSubscribe={subscribe}
          onUnsubscribe={(url) => removeFeeds([url])}
          onClose={() => setCatalogOpen(false)}
        />
      )}
      {prefsOpen && (
        <PrefsDialog
          translate={translate}
          onToggleTranslate={toggleTranslate}
          translateError={translateError}
          filters={state.filters}
          onSaveFilters={saveFilters}
          events={model.events}
          onResetModel={() => setModel(emptyModel())}
          density={state.prefs.density}
          onChangeDensity={(density) => setPref("density", density)}
          readingSize={state.prefs.readingSize}
          onChangeReadingSize={(size) => setPref("readingSize", size)}
          readingFont={state.prefs.readingFont}
          onChangeReadingFont={(font) => setPref("readingFont", font)}
          onClose={() => setPrefsOpen(false)}
        />
      )}
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {editing?.kind === "feed" &&
        (() => {
          const feed = state.feeds.find((f) => f.url === editing.url);
          return feed ? (
            <EditFeedDialog
              feed={feed}
              folders={state.folders}
              onSave={(changes) => editFeed(feed.url, changes)}
              onRemove={() => removeFeeds([feed.url])}
              onClose={() => setEditing(null)}
            />
          ) : null;
        })()}
      {editing?.kind === "folder" && (
        <EditFolderDialog
          name={editing.name}
          feedCount={state.feeds.filter((f) => (f.folder || "") === editing.name).length}
          onRename={(to) => moveFolder(editing.name, to)}
          onUngroup={() => moveFolder(editing.name, "")}
          onRemoveAll={() =>
            removeFeeds(state.feeds.filter((f) => (f.folder || "") === editing.name).map((f) => f.url))
          }
          onClose={() => setEditing(null)}
        />
      )}

      {toast && (
        <div
          key={toast}
          role="status"
          className="toast pointer-events-none fixed left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface px-4 py-2 text-ui shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
