export type Feed = {
  /** 購読の一意キー。フィードURLをそのまま使う */
  url: string;
  title: string;
  siteUrl: string;
  /** 空文字なら未分類 */
  folder: string;
  addedAt: number;
};

export type Article = {
  /** guid / id / link から作る安定ID */
  id: string;
  feedUrl: string;
  feedTitle: string;
  title: string;
  link: string;
  author: string;
  publishedAt: number | null;
  /** プレーンテキストの抜粋 */
  summary: string;
  /** サニタイズ済みHTML */
  content: string;
  image: string | null;
};

export type ParsedFeed = {
  url: string;
  title: string;
  siteUrl: string;
  description: string;
  articles: Article[];
};

export type FeedResult =
  | { ok: true; feed: ParsedFeed }
  | { ok: false; url: string; error: string };

export type View =
  | { kind: "all" }
  | { kind: "starred" }
  | { kind: "folder"; name: string }
  | { kind: "feed"; url: string };

export function viewKey(view: View): string {
  switch (view.kind) {
    case "all":
      return "all";
    case "starred":
      return "starred";
    case "folder":
      return `folder:${view.name}`;
    case "feed":
      return `feed:${view.url}`;
  }
}

/** フィード探索の結果候補 */
export type Candidate = {
  url: string;
  title: string;
  siteUrl: string;
  description: string;
  itemCount: number;
};
