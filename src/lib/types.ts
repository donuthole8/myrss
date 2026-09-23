export type Feed = {
  /** 購読の一意キー。フィードURLをそのまま使う */
  url: string;
  title: string;
  siteUrl: string;
  /** 空文字なら未分類 */
  folder: string;
  addedAt: number;
  /** 自分で名前を付けたら、配信側のタイトルで上書きしない */
  renamed?: boolean;
};

/** 配信元が教えてくれる盛り上がりの指標 */
export type Buzz = {
  /** はてなブックマーク数 */
  hatena?: number;
  /** Hacker News のポイント */
  points?: number;
  /** コメント数 */
  comments?: number;
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
  buzz?: Buzz;
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
  /** 購読全体からキーワードで拾う横断ビュー */
  | { kind: "topic"; id: "ai" }
  /** 複数ソースで取り上げられている・ブクマが多い記事のランキング */
  | { kind: "trending" }
  /** 自分で登録したキーワードの横断ビュー */
  | { kind: "watch"; keyword: string }
  | { kind: "folder"; name: string }
  | { kind: "feed"; url: string };

export function viewKey(view: View): string {
  switch (view.kind) {
    case "all":
      return "all";
    case "starred":
      return "starred";
    case "topic":
      return `topic:${view.id}`;
    case "trending":
      return "trending";
    case "watch":
      return `watch:${view.keyword}`;
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
